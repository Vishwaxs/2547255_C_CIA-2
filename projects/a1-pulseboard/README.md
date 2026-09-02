# A1 PulseBoard — real-time metrics dashboard

Push metric events at PulseBoard and watch a dashboard update **live** — tiles, sparklines,
and a rate/max readout that move in real time, with **threshold alerts** that fire the
moment a metric crosses its limit. A built-in **event simulator** makes the whole thing
pulse out of the box, so there's nothing to wire up to see it work.

The portfolio angle: every other project is request/response or batch. PulseBoard is the
only **real-time / streaming** system — the interesting engineering is **server push over
Server-Sent Events**, a **Redis sliding-window aggregator**, and **edge-triggered alerting**.

> **It runs air-gapped.** The simulator generates its own traffic and SSE is server→client
> only, so there are no external services and no keys. Redis is a *genuine* dependency here
> (the live window lives in Redis) — with a fail-open fallback to Postgres. See
> [`DECISIONS.md`](DECISIONS.md).

---

## Architecture

```
  producers ──► POST /api/events          browser ──► GET /api/stream  (EventSource)
       │              │  ingest                            ▲  text/event-stream
       ▼              ▼                                     │
   simulator   ┌── ingestEvent ──┐          ┌──── broadcaster (1 loop, N clients) ────┐
   (built-in)  │ persist Event    │          │ every SNAPSHOT_MS:                       │
               │ ZADD Redis window│          │   snapshot() = for each metric:         │
               │ trim old (ZREM)  │          │     read Redis window (PG fallback)     │
               └──────────────────┘          │     aggregate() + evaluate threshold    │
                       │                      │   reconcileAlerts() (edge-triggered)    │
                       ▼                      │   write SSE frame to every client       │
                  PostgreSQL                  └──────────────────────────────────────────┘
        Metric · Event · Bucket · Alert          rollup job (60s): Event[] → per-minute Bucket
```

The live sliding-window aggregates live in **Redis sorted sets** (`pulse:win:{metricId}`,
score = timestamp); the SSE **broadcaster** fans a single snapshot out to all connected
clients each tick; a **rollup job** folds raw events into per-minute `Bucket`s for history.

### Data model

| Model | Key fields |
|---|---|
| `Metric` | id, name (unique), unit, **thresholdType** (`none`/`max_avg`/`max_value`/`max_rate`), thresholdValue? |
| `Event` | id, metricId, value, tags (Json), ts ·· `@@index([metricId, ts])` |
| `Bucket` | id, metricId, minute, count, sum, min, max ·· `@@unique([metricId, minute])` |
| `Alert` | id, metricId, level (`warning`/`critical`), message, value, threshold, ts, resolvedAt? |

### Real-time engine

- **Sliding window** (`engine/window.ts`) — pure: points + now + windowMs → {count, sum,
  avg, min, max, ratePerSec}.
- **Thresholds** (`engine/threshold.ts`) — pure: breach detection, `critical` past 1.25×.
- **Rollup** (`engine/rollup.ts`) — pure: events → per-minute buckets.
- **Ingest** — persist + `ZADD`/`ZREMRANGEBYSCORE` the Redis window (fail-open).
- **Aggregate** — read the Redis window (fallback to a Postgres query on Redis error).
- **Broadcaster** — one `setInterval` builds a snapshot and writes an SSE frame to every
  client; alerts are reconciled **edge-triggered** (one alert per breach, resolved on recovery).

---

## Run it

### Option A — full stack in Docker (needs Docker daemon)

```bash
cd projects/a1-pulseboard
docker compose -f docker-compose.full.yml up --build
# frontend → http://localhost:8085
# backend  → http://localhost:4005
```

### Option B — host-based dev (Docker for infra only)

```bash
cd projects/a1-pulseboard
docker compose up -d            # Postgres:5437 + Redis:6384

cd backend
cp .env.example .env
npm ci
npm run prisma:migrate:dev
npm run dev                     # http://localhost:4005 (API + SSE broadcaster + rollup)

cd ../frontend
cp .env.example .env
npm ci
npm run dev                     # http://localhost:5178
```

### Option C — no Docker daemon

```bash
bash scripts/local-services.sh  # Postgres:5437 + Redis:6384 via pg_ctl + redis-server
# then follow Option B from `npm run prisma:migrate:dev`
```

### Try it in 30 seconds (UI)

1. **Live** tab → **Start simulator**. The connection dot goes green and the tiles start
   pulsing — live averages, sparklines, and rate/max updating every second over SSE.
2. Watch the **cpu** tile flip amber/red when a spike crosses 90, and an **active alert**
   appears. Stop the simulator any time.
3. **History** tab → pick a metric to see its per-minute trend. **Alerts** tab → the full
   alert log (active + resolved).
4. Push your own data: `curl -XPOST localhost:4005/api/events -d '{"metric":"cpu","value":95}' -H 'content-type: application/json'`.

---

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/metrics` | Define a metric (name, unit, threshold). |
| POST | `/api/metrics/seed` | Load the 4 default demo metrics. |
| GET  | `/api/metrics` | All metrics with their current live snapshot. |
| GET  | `/api/metrics/:name/series` | Per-minute historical buckets. |
| POST | `/api/events` | Ingest one event or a batch (`{metric, value, tags?, ts?}`). |
| GET  | `/api/stream` | **Server-Sent Events** — live snapshots + alerts. |
| GET  | `/api/alerts` | Recent alerts (active + resolved). |
| POST | `/api/simulator/start` \| `/stop` | Toggle the built-in event generator. |
| GET  | `/api/simulator` | Simulator state. |
| GET  | `/healthz` | Postgres + Redis ping; 200 or 503. |

---

## Tests

```bash
cd backend
npm test   # Jest: 15 tests (window/threshold/rollup units + e2e incl. an SSE smoke test)
```

The integration suite drives the real routes with supertest against live Postgres + Redis:
ingest → the live snapshot reflects the aggregates, a threshold breach fires **one**
edge-triggered alert (no duplicate on the next tick), events **roll up** into per-minute
buckets exposed by the series endpoint, and a real `http` client connecting to
`GET /api/stream` receives a live **SSE frame**. Runs with `START_STREAM=false` so no
background intervals leak into the tests.

CI ([`.github/workflows/a1pulseboard-ci.yml`](../../.github/workflows/a1pulseboard-ci.yml)):
path-filtered on `projects/a1-pulseboard/**`, Postgres + Redis service containers, two
jobs (backend typecheck + migrate + test; frontend build).

---

## Resume one-liners

- Built a **real-time metrics dashboard**: an ingest API feeding a **Redis sliding-window
  aggregator**, a **Server-Sent-Events broadcaster** that fans one snapshot loop out to
  every connected client, **edge-triggered threshold alerting**, per-minute rollups for
  history, and a built-in **event simulator** so it pulses with zero external traffic.
- The only real-time/streaming system in the portfolio; Redis is a genuine dependency (the
  live window) with a **fail-open** fallback to Postgres, and the whole thing runs offline.

See [`DECISIONS.md`](DECISIONS.md) for the decision log / interview cheat sheet.
