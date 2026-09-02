# SyncBridge — integration hub (iPaaS-lite)

A mini-iPaaS: define a **connector** for each system you want to wire together,
draw a **sync flow** between two of them with a **declarative field-mapping +
transform layer**, run it on demand or on a cron, and get a **per-record audit
log of every sync** — including how each conflict was resolved.

The portfolio angle: connecting multiple third-party systems with a
transform/mapping layer is something none of my other projects do. The
interesting engineering is the **sync engine** — idempotent upserts and
conflict resolution over historical state — not any single integration.

> **Connectors are mocked on purpose.** This build ships `mock_crm` / `mock_sheet` /
> `mock_slack` connectors backed by a local Postgres table, so the whole thing is
> deterministic and runnable by anyone with no OAuth keys or external network. A
> real HubSpot/Sheets/Slack connector drops in by implementing the same
> `Connector` interface — the sync engine never changes. See
> [`DECISIONS.md`](DECISIONS.md).

---

## Architecture

```
  React config UI ──► POST /api/flows/:id/trigger
  (TanStack Query)         │
                           ▼
                    enqueue (BullMQ)  ──or──  inline (tests)
                           │
                           ▼
        ┌──────────────  runSync(flowId)  ──────────────┐
        │ 1. source.list()            (Connector.list)   │
        │ 2. applyMappings(rec, rules)  source→target    │
        │ 3. target.findByExternalId()                   │
        │ 4. decide: create | update | skip | conflict   │
        │      conflict → resolve(strategy)              │
        │ 5. target.upsert()  +  write AuditEntry        │
        └────────────────────────────────────────────────┘
                           ▼
                    PostgreSQL (Prisma)
   Connector · ExternalRecord · SyncFlow · FieldMapping · SyncRun · AuditEntry
```

The `Connector` interface (`list` / `findByExternalId` / `upsert`) is the swap
point: every "system" is just an implementation. Scheduled flows register
cron-repeatable BullMQ jobs; manual/event triggers enqueue a one-off job, and
the worker calls the same `runSync` the tests call directly.

### Data model

| Model | Key fields |
|---|---|
| `Connector` | id, name, kind (`mock_crm`/`mock_sheet`/`mock_slack`), config |
| `ExternalRecord` | id, connectorId, externalId, data (Json), updatedAt ·· `@@unique([connectorId, externalId])` |
| `SyncFlow` | id, name, sourceConnectorId, targetConnectorId, schedule?, enabled, conflictStrategy, lastSyncedAt? |
| `FieldMapping` | id, flowId, sourceField, targetField, transform |
| `SyncRun` | id, flowId, trigger, startedAt, completedAt?, status, recordsRead/Upserted/Skipped/Conflicted |
| `AuditEntry` | id, syncRunId, externalId, action, sourcePayload, mappedPayload, detail? ·· `@@index([syncRunId])` |

### Transforms (field-mapping layer)

`none` · `uppercase` · `lowercase` · `trim` · `number` (coerce, null if NaN) ·
`date_iso` (normalize to ISO-8601, null if unparseable).

### Conflict resolution

A record is a **conflict** only when *both* sides changed since the flow last ran
(`source.updatedAt` and `target.updatedAt` are both newer than `lastSyncedAt`)
**and** the mapped payload still disagrees with the target. Otherwise a changed
source simply updates the target, and an unchanged source is skipped (idempotent).

| Strategy | Winner |
|---|---|
| `source_wins` | always the source — target overwritten |
| `target_wins` | always the target — source change discarded |
| `newest_wins` | whichever side has the newer `updatedAt` |

Idempotency comes from comparing a stable (key-sorted) serialization of the
mapped payload against the target's current data — re-running a flow with no
source changes yields an all-`skipped` run.

---

## Run it

### Option A — full stack in Docker (needs Docker daemon)

```bash
cd projects/c1-syncbridge
docker compose -f docker-compose.full.yml up --build
# frontend → http://localhost:8082
# backend  → http://localhost:4002
```

### Option B — host-based dev (Docker for infra only)

```bash
cd projects/c1-syncbridge
docker compose up -d            # Postgres:5434 + Redis:6381

# backend
cd backend
cp .env.example .env
npm ci
npm run prisma:migrate
npm run dev                     # http://localhost:4002 (API + sync worker)

# frontend (new shell)
cd ../frontend
cp .env.example .env
npm ci
npm run dev                     # http://localhost:5175
```

### Option C — no Docker daemon

```bash
bash scripts/local-services.sh  # Postgres:5434 + Redis:6381 via pg_ctl + redis-server
# then follow Option B from `npm run prisma:migrate`
```

### Try it in 30 seconds (UI)

1. **Connectors** tab → add two connectors (e.g. *Acme CRM* and *Ops Sheet*).
2. On the source, click **Seed 3** to load demo contacts.
3. **Flows** tab → build a flow: pick source + target, add mappings
   (`last_name → uppercase → Last`, `email → trim → Email`), **Create flow**.
4. Open the flow → **Sync now** → watch the audit log fill with `created` rows.
   Hit it again → everything is `skipped`. Edit the source and re-sync → one `updated`.

---

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/connectors` | Create connector (`name`, `kind`). |
| GET  | `/api/connectors` | List connectors with record counts. |
| POST | `/api/connectors/:id/seed` | Seed demo data: `{ count }` or explicit `{ records[] }`. |
| GET  | `/api/connectors/:id/records` | View a system's records. |
| DELETE | `/api/connectors/:id` | Delete connector + cascade. |
| POST | `/api/flows` | Create flow (source, target, `conflictStrategy`, `schedule?`, `mappings[]`). |
| GET  | `/api/flows` | List flows with last-run summary. |
| GET  | `/api/flows/:id` | Flow detail (mappings + recent runs). |
| PATCH | `/api/flows/:id` | Enable/disable, change schedule or strategy. |
| DELETE | `/api/flows/:id` | Delete flow + cascade. |
| POST | `/api/flows/:id/trigger` | Run the flow. `202` + run id (queued) or the completed run (inline). |
| GET  | `/api/flows/:id/runs` | Recent runs for a flow. |
| GET  | `/api/runs/:id` | Run detail with the full per-record audit log. |
| GET  | `/healthz` | Postgres + Redis ping; 200 or 503. |

---

## Tests

```bash
cd backend
npm test   # Jest: 7 mapping units + 6 conflict units + 8 e2e integration (21 total)
```

The integration suite drives the real routes with supertest against live
Postgres and asserts the four sync outcomes end-to-end: **created** (first sync),
**skipped** (idempotent re-sync), **updated** (one changed source record), and
**conflict_resolved** (both sides changed). Tests run the engine inline
(`START_WORKER=false`) so they need no Redis/queue.

CI ([`.github/workflows/syncbridge-ci.yml`](../../.github/workflows/syncbridge-ci.yml)):
path-filtered on `projects/c1-syncbridge/**`, Postgres + Redis service
containers, two jobs (backend typecheck + migrate + test; frontend build).

---

## Resume one-liners

- Built a **mini-iPaaS**: a pluggable `Connector` interface, a **declarative
  field-mapping + transform engine**, and a **per-record audit log** of every sync.
- Implemented **idempotent upserts** (keyed by external id + a stable content
  hash, so re-syncs are all-skipped) with **three conflict-resolution strategies**
  (source / target / newest-wins) over historical `lastSyncedAt` state.
- **Scheduled + event-driven** sync on BullMQ (Redis), with the sync engine
  decoupled from the queue so the core is fully testable without infrastructure.

See [`DECISIONS.md`](DECISIONS.md) for the decision log / interview cheat sheet.
