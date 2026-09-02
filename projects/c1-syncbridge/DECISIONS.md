# SyncBridge — Decision Log / Interview Cheat Sheet

## D1 · Mock connectors behind a swappable interface (the headline call)

The catalog spec calls for OAuth connectors to HubSpot / Google Sheets / Slack.
This build was developed in an air-gapped environment with no external network
and no OAuth credentials, so real connectors could be neither built nor verified.
Rather than ship unrunnable, unverifiable integration code, I defined a
`Connector` interface (`list` / `findByExternalId` / `upsert`) and implemented
`MockConnector`, backed by a Postgres `ExternalRecord` table partitioned by
connector id. Two mock connectors behave like two independent external systems.

Why this is the *right* portfolio artifact, not a cop-out:
- The interesting engineering — the sync engine, mapping layer, conflict
  resolution, audit log — is exercised identically whether the connector is mock
  or real. The engine depends only on the interface.
- It's deterministic and reproducible: anyone can clone and run the full flow
  with zero credentials.
- A real `HubSpotConnector` drops in at `connectors/factory.ts` by implementing
  the same three methods. Nothing else changes.

This is the same philosophy QAForge used (a local stub server instead of
external test targets).

## D2 · Express over NestJS

The catalog suggested NestJS. I stayed on Express + TypeScript to match the rest
of the monorepo (Snipr, QAForge) and because a solo portfolio build doesn't need
NestJS's DI/module ceremony. The structure is still cleanly separated by hand:
`connectors/`, `engine/`, `queue/`, `routes/`, `lib/`.

## D3 · Sync engine decoupled from the queue

`runSync` / `createRun` / `executeRun` live in `engine/sync.ts` and know nothing
about BullMQ. The worker (`queue/sync.worker.ts`) just calls them, and the tests
call `runSync` directly. This is why the 21-test suite needs no Redis: the engine
is pure orchestration over Prisma + the connector interface. The queue is an
delivery mechanism layered on top, not a dependency baked into the core.

## D4 · BullMQ for scheduled + event-driven sync

"Scheduled + event-driven" is a real queue's job. Scheduled flows register a
cron-repeatable job (`repeat: { pattern }`) keyed by `sched:<flowId>`; manual /
event triggers `add()` a one-off `execute` job carrying a pre-created run id.
BullMQ needs `maxRetriesPerRequest: null`, so I hand it plain connection options
(parsed from `REDIS_URL`) and let it own its connections — which also sidesteps a
type clash with BullMQ's bundled copy of ioredis.

Unlike Snipr/QAForge (where Redis is an optional, fail-open cache), SyncBridge's
**scheduler genuinely depends on Redis** — a legitimate architectural difference.
The manual trigger still degrades gracefully: if the enqueue throws, the route
falls back to running the sync inline.

## D5 · Conflict = both sides changed since last sync

A naïve sync overwrites the target every time. That silently destroys edits made
directly on the target. I track `SyncFlow.lastSyncedAt` and treat a record as a
**conflict** only when *both* `source.updatedAt` and `target.updatedAt` are newer
than `lastSyncedAt` and the mapped payload still differs. A source-only change is
a plain update; an unchanged source is skipped. Three strategies decide the
winner: `source_wins`, `target_wins`, `newest_wins` (compare `updatedAt`).

`lastSyncedAt` is set to `now()` only after a *clean* pass, and after the target
writes — so the engine's own writes never look like external target changes on
the next run.

## D6 · Idempotency via stable content comparison

Re-running a flow must not churn the target. Before writing, the engine compares
a key-sorted serialization (`stableStringify`) of the mapped payload against the
target's current data; equal → `skipped`. So a no-op sync is provably all-skipped
(asserted in the integration test). This also means the unique key is
`(connectorId, externalId)` — upserts are keyed by the record's identity in its
system, never by our internal cuid.

## D7 · Declarative mappings as rows, not a JSON blob

`FieldMapping` is one row per rule (sourceField, targetField, transform) rather
than a JSON array on the flow. The config UI edits rules individually, and rows
keep each rule independently queryable/validatable. (Contrast QAForge, where
assertions *are* a JSON blob — there the UI never edits a single assertion in
isolation, so a blob was simpler. Different UI, different choice.)

## D8 · Transforms as a small named registry

Transforms are a `Record<TransformName, (v) => v>` registry, not arbitrary code.
This keeps the mapping engine a pure, total function (every transform handles
wrong-typed input by passing through or returning null), makes the set
enumerable for the UI dropdown, and means a malicious flow can't inject logic —
it can only pick from a fixed vocabulary.

## D9 · Audit log persists every record action

The catalog's headline feature is "an audit log of every sync." Every record in
every run writes an `AuditEntry` with its action, the raw source payload, the
mapped payload, and (for conflicts) which strategy won. That's what makes the
tool trustworthy to a non-engineer: you can always answer "what did the last sync
do to this record, and why." Indexed by `syncRunId` for fast run-detail reads.

## D10 · Port scheme

Postgres 5434 · Redis 6381 · backend 4002 · frontend 5175 · docker-full frontend
8082 — each is +2 from Snipr (and +1 from QAForge), so all three projects' dev
stacks can run side by side without collisions.
