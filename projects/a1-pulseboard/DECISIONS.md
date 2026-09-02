# A1 PulseBoard — Decision Log / Interview Cheat Sheet

## D1 · Server-Sent Events for live push, not WebSockets or polling (headline)

The whole point of PulseBoard is that the dashboard updates *live*, so the transport is
the headline decision. I chose **SSE** over WebSockets and over client polling:

- vs **polling**: polling either lags (poll every 5s) or hammers the server (poll every
  200ms) and each request re-does auth/handshake. SSE pushes, so the client sees a change
  the instant the server computes it, over one long-lived connection.
- vs **WebSockets**: the data flow here is strictly server→client (the browser never sends
  metric data up the socket). WebSockets add a bidirectional protocol, upgrade handshake,
  and framing I don't need. SSE is plain HTTP (`text/event-stream`), auto-reconnects in the
  browser (`EventSource`), and passes through proxies as a normal response. It's the right
  tool precisely *because* the problem is one-directional.

The one thing to get right is buffering: the response sets `Cache-Control: no-cache` and
`X-Accel-Buffering: no`, and calls `flushHeaders()` so frames aren't held back.

## D2 · One broadcaster loop fans out to N clients (not a loop per connection)

A naïve SSE server runs the snapshot computation once per connected client per tick — N
clients means N× the database and Redis work every second. Instead there's a **single**
`setInterval` in `stream/broadcaster.ts` that builds the snapshot **once** and writes the
same frame to every client in a `Set<Response>`. Clients are added on connect and removed
on `req.on('close')`. Cost is O(1) snapshots regardless of dashboard count. The route also
sends an immediate frame on connect so a new tab isn't blank until the next tick.

## D3 · The live window lives in Redis (a genuine dependency), fail-open to Postgres

Unlike Snipr/D1 (where Redis is an optional cache), PulseBoard's **live sliding window is
Redis's job** — each metric is a sorted set `pulse:win:{metricId}` scored by timestamp;
ingest `ZADD`s the point and `ZREMRANGEBYSCORE`s anything older than the window. Reading
the window is a single `ZRANGEBYSCORE`. This is the natural data structure for a moving
time window and is a legitimate "Redis is load-bearing here" architectural point (like
SyncBridge's scheduler). It stays **fail-open**: if Redis errors, `windowPoints` rebuilds
the window from a Postgres `Event` query — slower, but the dashboard never goes dark, and
Postgres remains the durable record regardless.

## D4 · Edge-triggered alerting (one alert per breach, not one per tick)

The broadcaster evaluates thresholds every second. If it created an `Alert` row on every
tick a metric was over its limit, a 30-second breach would spawn 30 alerts. Instead
`reconcileAlerts` is **edge-triggered**: it opens exactly one alert when a metric *enters*
breach (no existing unresolved alert for it) and **resolves** that alert (`resolvedAt`)
when the metric recovers. A test asserts a second tick during a sustained breach creates no
duplicate. This is how real alerting systems behave — you get paged once, not every scrape.

## D5 · Three threshold types, warning/critical bands

A metric's threshold is `max_avg`, `max_value`, or `max_rate` — because "too high" means
different things: average latency, a single CPU spike, or a request-rate flood are each
checked against the matching aggregate. A breach is `critical` past **1.25×** the limit and
`warning` otherwise, so the board distinguishes "watch this" from "act now". The evaluator
is a pure function, unit-tested across all three types and both bands.

## D6 · A built-in simulator so a real-time system demos with no traffic

A real-time dashboard is unconvincing when it's flat. Since the container is air-gapped and
there are no real producers, `services/simulator.ts` generates synthetic events for the
demo metrics (start/stop from the UI), with occasional **spikes tuned to trip the seeded
thresholds** so alerts fire live during a demo. Same "generate your own inputs" philosophy
as the other projects' seeders — here it's what makes the pulse visible.

## D7 · Raw events + per-minute rollups (two time resolutions)

The live tiles need second-resolution recency (Redis window); the History chart needs
minutes-to-hours of trend without scanning millions of raw rows. So a background job rolls
raw `Event`s into `Bucket`s (`@@unique([metricId, minute])`, idempotent upsert). The live
path and the historical path read different stores tuned to their time scale — the same
"hot vs cold" split Snipr used for click analytics. Raw-event retention is the documented
scale boundary (a real deploy would expire old `Event` rows once bucketed).

## D8 · START_STREAM gates the background intervals

The broadcaster and rollup job are started in `server.ts` only when `START_STREAM=true`.
Tests set it to `false` and instead call `tickOnce()` / `runRollup()` directly, so there
are no leaked intervals and every assertion is deterministic — the same "engine decoupled
from its trigger" pattern as SyncBridge's worker. `START_STREAM` is off in CI too.

## D9 · Port scheme

Postgres 5437 · Redis 6384 · backend 4005 · frontend 5178 · docker-full frontend 8085 —
each +1 from E3 InsightDeck, so all six projects' dev stacks run side by side.
