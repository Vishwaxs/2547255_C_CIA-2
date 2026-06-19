# QAForge — Decision Log / Interview Cheat Sheet

## D1 · Express over NestJS

NestJS adds decorators, DI, and module boilerplate that are valuable in a long-lived team codebase but slow down solo portfolio builds. Express + TypeScript gives the same type safety with less ceremony. The architecture — engine module, route modules, Prisma client — is still clearly separated; I just wired it by hand rather than via a framework container.

## D2 · Async run pattern (202 + polling)

The first thing a test orchestrator must decide is: does the HTTP request block on the full run? For a suite of 30 tests with a 10 s timeout each, the answer has to be no. POST /api/runs returns 202 with the run ID immediately; `triggerRun` fires `executeRun` with `void` and lets the caller go. The frontend polls `GET /api/runs/:id` every 2 s until `completedAt` is set. This mirrors how real CI APIs (GitHub Actions, CircleCI) work.

## D3 · p-limit for bounded concurrency

Launching all N test cases as concurrent axios requests would be fine at N=5 but abusive at N=200. `p-limit(RUN_CONCURRENCY)` caps in-flight requests at a configurable ceiling (default 5). I chose p-limit@^3.x specifically — v4+ is ESM-only and the project compiles as CommonJS, so using v4 would have forced either dynamic `import()` or a full ESM migration for no benefit.

## D4 · Declarative JSON assertions stored on TestCase

Assertions are stored as `Json[]` on the `TestCase` row rather than a separate `Assertion` table. This keeps the data model simple (one row per test case, no join for reads) and assertion schemas can evolve without migrations — adding a new type means updating the TypeScript discriminated union and the `evaluateAssertion()` function, not the database schema. The trade-off is that assertion data is opaque to SQL; since we never filter or aggregate on individual assertion fields this is acceptable.

Three assertion types cover the most common HTTP contract checks:
- `status` — response status code equals expected
- `jsonBody` — dot-path field in response body is truthy or equals expected value
- `header` — response header (case-insensitive) contains a substring

## D5 · Flakiness score: flip-count ÷ (N−1)

The score is computed in application code (not SQL) over the last `FLAKINESS_WINDOW` RunResults per test case, ordered by run start time. A "flip" is any transition where the current status differs from the previous one. Dividing by (N−1) normalizes the score to [0, 1]: 0 = perfectly stable, 1 = alternates every single run.

Why not a raw failure rate? Failure rate misses the pattern — a test that fails 50% of the time *consistently* at the end of a week is very different from one that alternates every run. Flakiness captures instability, not just failure.

Why not a SQL window function? The query is already paginated to `FLAKINESS_WINDOW` rows, the in-memory loop is O(N) where N ≤ 30, and keeping the logic in TypeScript makes it testable as a pure function without a database.

## D6 · Local Express stub server for integration tests

The integration suite needs a real HTTP target to call. External URLs (httpbin.org, etc.) were unavailable in the CI container due to network policy. Instead, `api.e2e.test.ts` starts a minimal Express app on a random port (`:0`), registers `/pass` (always 200 JSON), `/fail` (always 418), and `/flaky` (alternates via a module-level boolean), runs the test suite against it, then shuts it down in `afterAll`. No external dependency, deterministic, works in any network-isolated environment.

## D7 · ioredis with fail-open (no crash on Redis unavailability)

Redis is used only for health-check (`/healthz`). If the Redis connection fails, the backend logs a warning and continues — `lazyConnect: true` prevents the process from crashing on startup when Redis is temporarily unavailable. This is appropriate for a portfolio demo where Redis downtime should not take down the entire API.

## D8 · `@@index([testCaseId, runId])` on RunResult

The stats endpoint fetches RunResults grouped by testCaseId, ordered by runId. Without an index this is a sequential scan over the entire RunResult table per request. The composite index on `(testCaseId, runId)` means the database can satisfy the query with an index-only scan, which stays fast as run history grows.

## D9 · Multi-stage Dockerfile with `prisma migrate deploy` in CMD

The backend image runs `prisma migrate deploy && node dist/server.js` as its entrypoint rather than baking migrations into the build. This means the container can be pointed at any database (fresh or already migrated) and will apply only missing migrations idempotently. The trade-off is that the first startup takes an extra second or two; acceptable for a demo, wrong for a high-availability service where you'd run migrations as a separate init container.

## D10 · denormalized counts avoided

Unlike Snipr (which denormalizes `clickCount` on `Link` for fast reads), QAForge keeps `passed` and `failed` on the `Run` row computed once at run completion. There is no hot read path for these counts — the dashboard fetches them once per run poll — so denormalization buys nothing here. The counts are written once when `executeRun` finishes and never updated again.
