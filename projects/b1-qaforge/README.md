# QAForge — API test orchestrator + flaky-detection dashboard

Not just using a testing tool — building one. QAForge lets you define HTTP test
suites declaratively, run them on demand with bounded concurrency, track results
across runs, and surface **statistical flakiness scores** per test case.

The portfolio angle: none of my other projects demonstrated *test infrastructure as
a product* — a system where the test execution engine, the result schema, and the
analytics layer are all things I designed and built from scratch.

---

## Architecture

```
  React dashboard ──► POST /api/runs ──► triggerRun(suiteId)
  (TanStack Query)                          │
                                            │  1. Create Run row (startedAt)
  GET /api/suites/:id/stats ◄──────────    │  2. Fetch TestCases for suite
   flakiness scores + trend                 │  3. p-limit(5) concurrency:
                                            │       axios.request(baseUrl + path)
                                            │       evaluateAssertions(response, case.assertions)
                                            │       INSERT RunResult
                                            │  4. Update Run(completedAt, passed, failed)
                                            ▼
                                       PostgreSQL (Prisma)
```

The run engine returns `202` immediately with the run ID — the HTTP request
doesn't wait for all test cases to complete. The frontend polls `GET /api/runs/:id`
until `completedAt` is set.

### Data model

| Model | Key fields |
|---|---|
| `Suite` | id, name, baseUrl, timeoutMs, createdAt |
| `TestCase` | id, suiteId, name, method, path, headers (Json), body (Json?), assertions (Json[]) |
| `Run` | id, suiteId, triggeredBy, startedAt, completedAt?, totalTests, passed, failed |
| `RunResult` | id, runId, testCaseId, status ("pass"/"fail"), durationMs, statusCode?, failReason? ·· `@@index([testCaseId, runId])` |

### Assertion types (stored as JSON on TestCase)

| Type | Fields | What it checks |
|---|---|---|
| `status` | `expected: number` | HTTP response status code |
| `jsonBody` | `field: string` (dot-path), `op: "truthy"\|"eq"`, `expected?` | JSON response body field |
| `header` | `field: string`, `contains: string` | Response header substring |

### Flakiness score

```
flakinessScore = flips / (totalRuns − 1)    where flips = count of run-to-run status changes
```

Computed on-query over the last `FLAKINESS_WINDOW` runs per test case via a
sequential scan of ordered RunResult rows. Zero means perfectly stable; 1.0 means
the test flipped every run (maximally flaky).

---

## Run it

### Option A — full stack in Docker (needs Docker daemon)

```bash
cd projects/b1-qaforge
docker compose -f docker-compose.full.yml up --build
# frontend → http://localhost:8081
# backend  → http://localhost:4001
```

### Option B — host-based dev (Docker for infra only)

```bash
cd projects/b1-qaforge
docker compose up -d          # Postgres:5433 + Redis:6380

# backend
cd backend
cp .env.example .env
npm ci
npm run prisma:migrate
npm run dev                   # http://localhost:4001

# frontend (new shell)
cd ../frontend
cp .env.example .env
npm ci
npm run dev                   # http://localhost:5174
```

### Option C — no Docker daemon

```bash
bash scripts/local-services.sh   # boots Postgres:5433 + Redis:6380 via pg_ctl + redis-server
# then follow Option B from `npm run prisma:migrate`
```

---

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/suites` | Create suite (`name`, `baseUrl` required). Optionally include `cases[]` to seed test cases inline. |
| GET  | `/api/suites` | List suites with `caseCount` and `lastRun` summary. |
| GET  | `/api/suites/:id` | Suite detail with test cases. |
| PATCH | `/api/suites/:id` | Update suite metadata. |
| DELETE | `/api/suites/:id` | Delete suite + cascade. |
| POST | `/api/suites/:id/cases` | Add test case. |
| GET  | `/api/suites/:id/cases` | List cases for a suite. |
| DELETE | `/api/suites/:id/cases/:caseId` | Remove test case. |
| POST | `/api/runs` | Trigger run `{ suiteId }`. Returns `202` with run ID immediately. |
| GET  | `/api/runs/:id` | Run detail with all `RunResult` rows + `testCase.name`. |
| GET  | `/api/runs?suiteId=` | List last 50 runs for a suite. |
| GET  | `/api/suites/:id/stats` | Flakiness scores + pass-rate trend. |
| GET  | `/healthz` | Postgres + Redis ping; 200 or 503. |

---

## Tests

```bash
cd backend
npm test   # Jest: 16 assertion units + 7 e2e integration tests (23 total)
```

The integration suite uses a local Express stub server (no external network) as
the test target, with a `/flaky` endpoint that alternates 200/418 to generate a
real flakiness score after two runs.

CI ([`.github/workflows/qaforge-ci.yml`](../../.github/workflows/qaforge-ci.yml)):
path-filtered on `projects/b1-qaforge/**`, Postgres + Redis service containers, two
jobs (backend typecheck + migrate + test; frontend build).

---

## Resume one-liners

- Built a **test execution engine** in TypeScript: declarative HTTP suites, parallel
  execution (`p-limit`), assertion evaluation (status/jsonBody/header), results
  persisted to Postgres.
- Implemented a **statistical flakiness score** (flip-count ÷ (N−1) over last N runs)
  surfaced as a live leaderboard — the kind of signal that makes a noisy test suite
  actionable.
- The engine returns `202` immediately and runs async — redirect path never blocks on
  the test suite completing.

See [`DECISIONS.md`](DECISIONS.md) for the decision log / interview cheat sheet.
