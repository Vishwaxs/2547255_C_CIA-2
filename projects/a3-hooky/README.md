# A3 Hooky — webhook gateway & delivery

Register subscriptions, publish an event, and Hooky **fans it out and delivers it reliably**
— each request **HMAC-signed**, **retried with exponential backoff**, logged **per attempt**,
**dead-lettered** after the max attempts, and **replayable** on demand. A built-in set of
demo endpoints (reliable / flaky / broken / slow) makes every delivery path visible with no
external services.

The portfolio angle: none of the other projects do **reliable outbound delivery**. The
interesting engineering is the delivery pipeline — signing, at-least-once retries with
backoff, and dead-letter/replay — not any single integration.

> **It runs air-gapped.** Delivery targets sit behind a `DeliveryTransport` interface. The
> default `SinkTransport` simulates endpoints by a per-subscription `mode`, so retry/backoff/
> dead-letter/replay are deterministic and verifiable offline; a real `HttpTransport` (global
> `fetch`) drops in unchanged. **Zero runtime dependencies** beyond Express/Prisma. See
> [`DECISIONS.md`](DECISIONS.md).

---

## Architecture

```
  producer ──► POST /api/events                    dispatcher loop (every DISPATCH_INTERVAL_MS)
       │            │  publishEvent                        │  processDue(now)
       ▼            ▼                                        ▼
   (idempotency   ┌── fan out ──┐                 ┌──── for each due delivery ─────┐
    cache, Redis) │ Event       │                 │ sign (HMAC-SHA256)             │
                  │ + Delivery  │                 │ transport.send(url, mode, …)   │
                  │ per matching│                 │ log DeliveryAttempt            │
                  │ subscription│                 │ ok → delivered                 │
                  └─────────────┘                 │ fail → retrying (backoff) …    │
                        │                          │       … or dead at maxAttempts │
                        ▼                          └────────────────────────────────┘
                   PostgreSQL
     Subscription · Event · Delivery · DeliveryAttempt          replay → fresh run
```

A `Delivery` moves `pending → delivering → delivered | retrying → dead`. Retries are
scheduled by writing `nextAttemptAt = now + base·2^(attempt-1)`; the dispatcher simply
polls for due deliveries, so the schedule *is* the queue (no broker needed).

### Data model

| Model | Key fields |
|---|---|
| `Subscription` | id, name, endpoint, eventTypes (Json `["*"]`/list), **secret**, **mode** (ok/flaky/fail/slow), active, maxAttempts |
| `Event` | id, type, payload (Json), idempotencyKey?, createdAt |
| `Delivery` | id, eventId, subscriptionId, **status**, attempts, **nextAttemptAt**, lastError?, deliveredAt? ·· `@@index([status, nextAttemptAt])` |
| `DeliveryAttempt` | id, deliveryId, attempt, statusCode?, ok, durationMs, error?, at |

### Delivery engine

- **Signing** (`engine/sign.ts`) — HMAC-SHA256 over `timestamp.payload`, sent as
  `X-Hooky-Signature`/`-Timestamp`/`-Id`/`-Event`; constant-time `verify` for receivers.
- **Backoff** (`engine/backoff.ts`) — `base · 2^(attempt-1)`, capped; deterministic.
- **Transport** (`transport/`) — `DeliveryTransport` interface; `SinkTransport` (offline,
  mode-driven) + `HttpTransport` (real `fetch`) + factory.
- **Dispatch** (`services/dispatch.service.ts`) — `publishEvent` (fan-out), `processDue(now)`
  (sign → send → log → advance), `replay` (fresh run). The dispatcher job runs `processDue`
  on an interval; a fail-open **Redis idempotency cache** dedupes repeated publishes.

---

## Run it

### Option A — full stack in Docker (needs Docker daemon)

```bash
cd projects/a3-hooky
docker compose -f docker-compose.full.yml up --build
# frontend → http://localhost:8086
# backend  → http://localhost:4006
```

### Option B — host-based dev (Docker for infra only)

```bash
cd projects/a3-hooky
docker compose up -d            # Postgres:5438 + Redis:6385

cd backend
cp .env.example .env
npm ci
npm run prisma:migrate:dev
npm run dev                     # http://localhost:4006 (API + dispatcher worker)

cd ../frontend
cp .env.example .env
npm ci
npm run dev                     # http://localhost:5179
```

### Option C — no Docker daemon

```bash
bash scripts/local-services.sh  # Postgres:5438 + Redis:6385 via pg_ctl + redis-server
# then follow Option B from `npm run prisma:migrate:dev`
```

### Try it in 30 seconds (UI)

1. **Publish** tab → **Seed demo subscriptions** (reliable / flaky / broken / slow), then
   **Publish** an event.
2. **Deliveries** tab → watch the four deliveries progress as the worker runs: the reliable
   one turns **delivered**, the flaky one **retries then delivers**, the broken and slow ones
   climb through attempts and **dead-letter**. Expand any delivery to see its **attempt
   timeline** (each try, HTTP code, error, time).
3. Hit **Replay** on a dead delivery to re-run it with a fresh budget. **Analytics** → success
   rate + deliveries-by-status.

---

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/subscriptions` | Create (name, endpoint, eventTypes, mode, secret?, maxAttempts?). |
| POST | `/api/subscriptions/seed` | Seed one demo subscription per mode. |
| GET  | `/api/subscriptions` | List. |
| PATCH / DELETE | `/api/subscriptions/:id` | Toggle active / edit / delete. |
| POST | `/api/events` | Publish `{type, payload, idempotencyKey?}` → fan out. |
| GET  | `/api/deliveries?status=` | Deliveries (optionally filtered). |
| GET  | `/api/deliveries/:id` | Delivery + full attempt log. |
| POST | `/api/deliveries/:id/replay` | Re-queue for a fresh run. |
| GET  | `/api/stats` | By status, success rate, avg attempts. |
| GET  | `/healthz` | Postgres + Redis ping; 200 or 503. |

---

## Tests

```bash
cd backend
npm test   # Jest: 19 tests (sign/backoff/transport units + e2e delivery lifecycle)
```

The integration suite drives the real routes with supertest and the dispatch engine
directly (with an injected `now` so backoff needs no real waits): seed → publish fans out 4
deliveries → **ok delivered on attempt 1, flaky on attempt 3, broken/slow dead-lettered at
maxAttempts**, the per-attempt log is `[fail, fail, ok]`, a dead delivery **replays** with a
fresh budget, a repeated **idempotency key dedupes**, and stats/validation hold. Runs with
`START_WORKER=false` (no background loop) and the offline sink transport — no network, no keys.

CI ([`.github/workflows/a3hooky-ci.yml`](../../.github/workflows/a3hooky-ci.yml)):
path-filtered on `projects/a3-hooky/**`, Postgres + Redis service containers, two jobs
(backend typecheck + migrate + test; frontend build).

---

## Resume one-liners

- Built a **webhook gateway**: subscriptions with **HMAC-SHA256-signed** payloads, an
  at-least-once **delivery pipeline with exponential-backoff retries**, a per-attempt
  delivery log, **manual replay**, and **dead-lettering** after max attempts.
- Delivery targets sit behind a `DeliveryTransport` interface — a deterministic sink
  (ok/flaky/fail/slow) makes retry/backoff/dead-letter verifiable offline; a real `fetch`
  transport drops in unchanged. Retries are scheduled in Postgres (`nextAttemptAt`), so the
  schedule is the queue; a fail-open Redis idempotency cache dedupes publishes.

See [`DECISIONS.md`](DECISIONS.md) for the decision log / interview cheat sheet.
