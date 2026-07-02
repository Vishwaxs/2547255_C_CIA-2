# A3 Hooky — Decision Log / Interview Cheat Sheet

## D1 · Delivery targets behind a DeliveryTransport interface (headline)

A webhook dispatcher's whole job is POSTing to third-party URLs — impossible in an
air-gapped container. So delivery goes through a `DeliveryTransport` interface, and the
default `SinkTransport` simulates an endpoint by the subscription's `mode`: `ok` always
succeeds, `fail` always 500s, `flaky` fails until the 3rd attempt, `slow` times out. That
one design decision makes **retry, backoff, dead-letter, and replay all deterministic and
testable offline** — the interesting engineering runs identically whether the transport is
the sink or the real `HttpTransport` (global `fetch`), which drops in at the factory with no
change to the dispatcher. Same swap-seam philosophy as SyncBridge/D1/E3.

## D2 · The retry schedule *is* the queue (Postgres, no broker)

Rather than pull in a job broker, a `Delivery` carries its own `status` + `nextAttemptAt`,
and the dispatcher polls for rows that are `pending`/`retrying` with `nextAttemptAt <= now`
(`@@index([status, nextAttemptAt])`). Scheduling a retry is just writing a future
`nextAttemptAt`. This keeps the system to Postgres + Redis (no new dependency), is trivially
inspectable (the queue is a table you can query), and is plenty at portfolio scale. The
documented scale path is a real broker (BullMQ, like SyncBridge) once throughput demands it.

## D3 · `now` is injected into processDue (deterministic backoff, no test waits)

`processDue(now)` takes the current time as a parameter. In production the dispatcher passes
`Date.now()`; tests pass an advancing clock (`t0`, `t0+2s`, `t0+6s`, …) to walk a flaky
delivery through its backed-off retries and a broken one into dead-letter **in milliseconds,
with zero real waiting**. Making time an input instead of a global is the single thing that
makes retry logic cheap to test — otherwise you're stuck with sleeps and flakiness.

## D4 · HMAC-SHA256 signing over `timestamp.payload`

Every delivery is signed exactly like Stripe/GitHub webhooks: `HMAC-SHA256(secret,
"${timestamp}.${payload}")`, sent as `X-Hooky-Signature` with `X-Hooky-Timestamp`/`-Id`/
`-Event`. Signing the *timestamp plus body* (not just the body) means a captured payload
can't be replayed later under a fresh timestamp. `verify()` uses `crypto.timingSafeEqual` to
avoid leaking the comparison via timing. Built on `node:crypto` — no dependency.

## D5 · Edge behaviour: delivered / retrying / dead, with replay as a fresh run

A delivery ends in one of two terminal states: `delivered` (a 2xx) or `dead` (failed
`maxAttempts` times). Between, `retrying` carries the backoff. **Replay** resets a delivery to
`pending` with `attempts = 0` — a *fresh* run with a full retry budget — while the prior
`DeliveryAttempt` rows stay in the log, so the history of "it failed, we fixed the endpoint,
we replayed, it delivered" is fully preserved. This is the operational story that makes a
webhook system trustworthy.

## D6 · Exponential backoff, deterministic (documented jitter omission)

`nextDelayMs(attempt, base, cap) = min(base · 2^(attempt-1), cap)` — 2s, 4s, 8s, 16s, … A
real deployment adds random jitter to avoid a thundering herd of synchronized retries; I
deliberately left jitter out so the backoff schedule is unit-testable and reproducible, and
noted the trade-off. Knowing *why* you'd add jitter (and why a test build skips it) is the point.

## D7 · Fan-out on publish, one Delivery row per subscription

Publishing an event creates the `Event` then one `Delivery` per active subscription whose
`eventTypes` matches (or is `["*"]`). Each delivery is independent — its own attempts,
backoff, and terminal state — so one broken subscriber never blocks or affects the others.
The per-record `Delivery`→`DeliveryAttempt` shape mirrors SyncBridge's `SyncRun`→`AuditEntry`
and D1's `Query`→`Retrieval`: the audit trail is the trust feature.

## D8 · Fail-open Redis idempotency cache on publish

A producer that retries a publish shouldn't double-send. When an `idempotencyKey` is
supplied, publish checks a Redis key first and returns the original event (no re-fan-out) on
a hit; otherwise it records the key with a TTL. It's **fail-open** — a Redis outage simply
disables dedupe, deliveries still work (same posture as Snipr/D1). Redis is a genuine but
non-critical dependency here.

## D9 · START_WORKER gates the dispatcher loop

The dispatcher interval starts in `server.ts` only when `START_WORKER=true`. Tests set it
`false` and call `processDue(now)` directly, so there are no leaked timers and every
assertion is deterministic — the same "engine decoupled from its trigger" pattern as
SyncBridge's worker and PulseBoard's broadcaster.

## D10 · Port scheme

Postgres 5438 · Redis 6385 · backend 4006 · frontend 5179 · docker-full frontend 8086 —
each +1 from A1 PulseBoard, so all seven projects' dev stacks run side by side.
