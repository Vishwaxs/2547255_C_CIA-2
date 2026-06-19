# Snipr — URL shortener + click analytics, built read-heavy

A URL shortener where the interesting part isn't the shortening — it's that
**reads dwarf writes**. One `POST /api/links` can be followed by thousands of
`GET /:code` redirects. So the redirect path is treated as the hot path:
resolved links live in Redis (cache-aside, TTL), click analytics are written
**off** the request path through a buffered queue, and abuse is bounded by a
hand-rolled fixed-window rate limiter.

This is the system-design story I can walk an interviewer through end to end:
caching strategy, capacity math, async write path, and time-series analytics.

---

## Architecture

```
   create  POST /api/links                          redirect  GET /:code
 ┌────────────────────┐                          ┌─────────────────────────────┐
 │ React dashboard     │                          │ 1. redis.get link:{code}     │
 │ (Vite + TanStack    │   ┌──────────────┐       │      HIT  → 302 (X-Cache:HIT) │
 │  Query + Recharts)  │──►│ Express API  │       │      MISS ↓                  │
 └────────────────────┘   │  TypeScript  │       │ 2. Postgres lookup (Prisma)  │
            ▲             │  + Prisma    │       │ 3. redis.set link:{code} EX  │
            │ stats        └──────┬───────┘       │ 4. 302 redirect (X-Cache:MISS)│
            │                     │                │ 5. fire-and-forget:           │
   GET /api/links/:code/stats     │                │     RPUSH buf:clicks {event}  │
                                  ▼                └─────────────┬───────────────┘
                            ┌───────────┐                        │
                            │ PostgreSQL│◄───────────────────────┘
                            │  (Prisma) │   setInterval flush loop every N ms:
                            └───────────┘   LPOP buf:clicks (batch) →
                                  ▲         $transaction([ createMany(Click),
                                  └───────── update clickCount per link ])
```

**The redirect never waits on a write.** It resolves the target (ideally from
Redis), issues the 302, and pushes the click event onto a Redis list. A
background loop drains that list on an interval and persists clicks in one
batched transaction. If Redis is down, the limiter and buffer **fail open** so
redirects still work — analytics degrade, the product doesn't.

### Data model (Prisma)

| Model   | Key fields                                                                 |
|---------|---------------------------------------------------------------------------|
| `Link`  | `code` (unique), `targetUrl`, `isCustom`, `isActive`, `clickCount` (denormalized), `createdAt`, `expiresAt?` |
| `Click` | `linkId` (FK), `ts`, `referrer?`, `country?`, `uaHash?` — `@@index([linkId, ts])` |

`clickCount` is denormalized onto `Link` so the list view never aggregates;
the `Click` table backs the time-series stats endpoint.

### Redis keys

| Key                       | Purpose                                         |
|---------------------------|-------------------------------------------------|
| `link:{code}`             | Cached target URL (cache-aside, `LINK_CACHE_TTL_SECONDS`) |
| `buf:clicks`              | List buffer of pending click events (RPUSH/LPOP) |
| `rl:{scope}:{ip}:{bucket}`| Fixed-window rate-limit counter (INCR + EXPIRE)  |

---

## Measured performance

All numbers below are **self-measured** in this dev container (single Postgres +
Redis on the same host, k6 driving the redirect path). They are honest local
figures, not borrowed benchmarks — treat them as relative, not absolute.

| Path                          | avg     | p95     |
|-------------------------------|---------|---------|
| Redirect, **cache HIT** (Redis)  | 1.11 ms | 1.40 ms |
| Redirect, **cache MISS** (Postgres) | 2.16 ms | 2.58 ms |

Under k6 at 50 concurrent VUs: **≈ 4,900 req/s** sustained on the redirect path
with p95 ≈ 18 ms (includes HTTP + scheduling overhead, not just resolution).
The cache-aside hop is ~2× faster than the Postgres fallback — the whole point
of the design, demonstrated rather than asserted.

Load script: [`load/k6-redirect.js`](load/k6-redirect.js) — ramps 0→20→50→0 VUs,
with thresholds `http_req_duration p(95)<50` and `redirect_errors rate<0.01`.

### Why caching pays off here (capacity sketch)

Assume 10M links, a hot set of ~100k links serving 90% of traffic (Zipfian — a
few links go viral). At a 3,600 s TTL the hot set stays resident in Redis after
the first miss, so steady-state redirect traffic is almost entirely L1 hits.
Postgres only sees cold misses + the batched click writes. At ~200 bytes per
cached target, 100k hot links ≈ 20 MB of Redis — trivial. That's the lever:
spend a few MB of cache to keep the read path off the database.

---

## Run it

### Option A — full stack in Docker (needs a Docker daemon)

```bash
cd projects/a2-snipr
docker compose -f docker-compose.full.yml up --build
# frontend → http://localhost:8080
# backend  → http://localhost:4000
```

This brings up Postgres, Redis, the backend (auto-runs `prisma migrate deploy`
on start), and the nginx-served frontend.

### Option B — host-based dev (Docker for infra only)

```bash
cd projects/a2-snipr
docker compose up -d            # Postgres + Redis only

# backend
cd backend
cp .env.example .env
npm ci
npm run prisma:migrate
npm run dev                     # http://localhost:4000

# frontend (new shell)
cd ../frontend
cp .env.example .env
npm ci
npm run dev                     # http://localhost:5173
```

### Option C — no Docker daemon at all

`scripts/local-services.sh` boots Postgres (`pg_ctl`) and Redis
(`redis-server --daemonize`) directly on the host — used to develop and verify
this project in a container without Docker. Run it, then follow Option B from
`npm run prisma:migrate` onward.

---

## API

| Method | Path                       | Notes                                              |
|--------|----------------------------|----------------------------------------------------|
| POST   | `/api/links`               | Create. Body `{ targetUrl, customAlias?, expiresAt? }`. 409 on alias collision, 400 on invalid URL. Rate-limited (strict). |
| GET    | `/api/links`               | List links (code, target, clickCount).             |
| GET    | `/api/links/:code`         | One link's metadata.                               |
| GET    | `/api/links/:code/stats`   | Time series (clicks/day) + top referrers + top countries. |
| GET    | `/:code`                   | 302 redirect. Sets `X-Cache: HIT\|MISS`. Rate-limited (loose). |
| GET    | `/healthz`                 | Pings Postgres + Redis; 200 or 503.                |

Exceeding a rate-limit window returns **429** with `X-RateLimit-Limit` /
`X-RateLimit-Remaining` headers.

---

## Tests

```bash
cd backend
npm test            # Jest: base62 units + supertest integration (cache-aside, flush, 4xx/429)
```

The integration suite proves the load-bearing behavior: a cold code returns
`X-Cache: MISS` then `HIT` on repeat, buffered clicks persist after a flush, and
the stats endpoint returns real aggregates. CI
([`.github/workflows/snipr-ci.yml`](../../.github/workflows/snipr-ci.yml)) runs
this against Postgres + Redis service containers, plus a frontend build.

---

## Resume one-liners (from real runs here)

- Built a URL shortener with **Redis cache-aside (TTL)** on the redirect path;
  measured cache-hit redirect **p95 ≈ 1.4 ms** vs **2.6 ms** uncached, ≈ 4,900
  req/s under k6 at 50 VUs.
- Designed a **buffered write path** (Redis list + batched flush loop) so reads
  stay hot while click analytics persist asynchronously in one transaction.
- Hand-rolled a **Redis fixed-window rate limiter** (fail-open) and time-series
  click analytics (geo via offline `geoip-lite`, referrer, time bucket).

See [`DECISIONS.md`](DECISIONS.md) for the decision log / interview cheat sheet.
