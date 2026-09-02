# C2 TargetX — feature flags + targeting engine

Define feature flags, target them at users with **ordered rules**, roll them out to a
**deterministic percentage** of traffic via consistent hashing, run **A/B experiments** by
weight — and for every evaluation get back not just the answer but the **reason**. Every
evaluation logs an **exposure**, so the experiment split is real data, not a guess.

This is a LaunchDarkly-lite: the whole evaluation engine (clause matching, consistent-hash
bucketing, weighted variant assignment, rule ordering, exposure analytics) is real and
**fully deterministic**. There is nothing to mock — it's pure logic + hashing with no
external service — so it runs identically here and in CI with zero credentials.

The portfolio angle: none of the other seven projects touch **rule-based targeting +
deterministic bucketing + flag evaluation**. The interesting engineering is the
**evaluation engine**, and it's the same code whether a flag is toggled from this UI or
pulled by an SDK.

---

## Architecture

```
  React UI ──► POST /api/flags/:key/evaluate  { unitKey, attributes }
  (TanStack)                    │
                                ▼
        ┌──────────────── evaluate(flag, ctx) — pure & total ─────────────────┐
        │  flag disabled?         → offVariation           reason=flag_off      │
        │  first matching rule?   → serve variation/rollout reason=rule_match:N │
        │  else                   → fallthrough variation/rollout reason=fallthrough │
        │                                                                       │
        │  a rollout resolves via bucket(flagKey:unitKey) → 0..100 (sticky)     │
        │  → assignVariant(weights, bucket)  — consistent hashing (sha1)        │
        └───────────────────────────────────────────────────────────────────────┘
                     │ getFlagWithConfig: Redis cache (fail-open)  │ logExposure (fail-open)
                     ▼                                             ▼
              PostgreSQL (Prisma)                          Exposure rows
        Flag · Rule(order) · Exposure          → GET /api/flags/:key/stats (the A/B split)
```

The engine is **pure and total**: `evaluate(flag, ctx)` never throws and always returns a
variation + a reason. Flag config is assembled from Postgres, cached in Redis (fail-open,
invalidated on any mutation), and every evaluation writes an `Exposure` row that powers the
experiment analytics.

### Data model

| Model | Key fields |
|---|---|
| `Flag` | id, **key (unique)**, name, enabled, **variations (Json `[{key,value}]`)**, **fallthrough (Json: `{variationKey}` \| `{rollout:[{variationKey,weight}]}`)**, offVariationKey |
| `Rule` | id, flagId, **order**, conditions (Json `[{attribute,op,values}]`), serve (Json, same shape as fallthrough) ·· `@@index([flagId, order])` |
| `Exposure` | id, flagId, unitKey, variationKey, **reason**, ruleOrder? ·· `@@index([flagId, ts])` — the raw experiment data |

### The evaluation engine (pure, the interview centerpiece)

- **Clauses** (`engine/clause.ts`) — `matchClause` for `eq/neq/in/notIn/contains/startsWith/
  gt/gte/lt/lte/exists`; `matchRule` = **AND** of clauses (empty list = catch-all).
- **Bucketing** (`engine/bucket.ts`) — `bucket(flagKey, unitKey)` sha1-hashes to a stable
  `0..100` position, so the **same unit always lands in the same bucket** for a flag (sticky
  rollout, consistent across servers). `assignVariant(rollout, bucket)` picks a variation
  from normalized weights.
- **Evaluate** (`engine/evaluate.ts`) — off → first-matching-rule (in `order`) → fallthrough;
  a fixed `variationKey` or a `rollout` at each step; every result carries a **reason**
  (`flag_off` | `rule_match:N` | `fallthrough`).
- **Exposure logging** — `services/eval.service.ts` writes one `Exposure` per evaluation
  (fail-open), the data behind the experiment split.
- **Config cache** — `services/flag.service.ts` caches assembled flag config in Redis
  (fail-open; a Redis outage just recomputes from Postgres) and **invalidates on every
  create/update/delete/rule change**, so evaluation is hot but never stale.

---

## Run it

### Option A — full stack in Docker (needs Docker daemon)

```bash
cd projects/c2-targetx
docker compose -f docker-compose.full.yml up --build
# frontend → http://localhost:8087
# backend  → http://localhost:4007
```

### Option B — host-based dev (Docker for infra only)

```bash
cd projects/c2-targetx
docker compose up -d            # Postgres:5439 + Redis:6386

# backend
cd backend
cp .env.example .env
npm ci
npm run prisma:migrate:dev
npm run dev                     # http://localhost:4007

# frontend (new shell)
cd ../frontend
cp .env.example .env
npm ci
npm run dev                     # http://localhost:5180
```

### Option C — no Docker daemon

```bash
bash scripts/local-services.sh  # Postgres:5439 + Redis:6386 via pg_ctl + redis-server
# then follow Option B from `npm run prisma:migrate:dev`
```

### Try it in 30 seconds (UI)

1. **Flags** tab → **Seed demo flags** (3 flags: a country-targeted boolean, a 34/33/33
   pricing experiment, a plan-gated boolean).
2. **Evaluate** tab → unit `user-123`, attributes `{"country":"US","plan":"pro"}` →
   **Evaluate all** → see each flag's variation + a colour-coded **reason** badge.
3. Change `country` to `GB` → `new-onboarding` flips from `rule_match:0` to `fallthrough`.
4. Change the unit key a few times on `pricing-page` → the variation changes, but the **same
   unit key always returns the same variation** (sticky bucketing).
5. **Experiments** tab → pick `pricing-page` → the exposure split per variation (the live
   A/B chart), built from every evaluation you just ran.

---

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/flags` | Create a flag (`key`, `name`, `variations[≥2]`, `fallthrough`, `offVariationKey`). |
| GET  | `/api/flags` | List flags with rule counts. |
| GET  | `/api/flags/:key` | Flag + its ordered rules. |
| PATCH | `/api/flags/:key` | Enable/disable, rename, change fallthrough/off. |
| DELETE | `/api/flags/:key` | Delete flag (cascade rules). |
| POST | `/api/flags/seed` | Load the 3 demo flags. |
| POST | `/api/flags/:key/rules` | Add a targeting rule (`conditions[]`, `serve`). |
| DELETE | `/api/flags/:key/rules/:ruleId` | Remove a rule. |
| POST | `/api/flags/:key/evaluate` | `{ unitKey, attributes }` → variation + value + **reason**; logs an exposure. |
| POST | `/api/evaluate` | Evaluate **every** flag for one context (SDK-style batch). |
| GET  | `/api/flags/:key/stats` | Exposure counts + share per variation, and by reason. |
| GET  | `/healthz` | Postgres + Redis ping; 200 or 503. |

---

## Tests

```bash
cd backend
npm test   # Jest: 26 tests (clause + bucket + assign + evaluate units, e2e integration)
```

The integration suite drives the real routes with supertest against live Postgres + Redis
and proves the engine end-to-end with **no network and no keys**: it seeds, targets a US
context to the rule variation while a GB context falls through, serves the off variation
when disabled, drives a **34/33/33 rollout over 300 unit keys** (asserting every variation
gets a real share **and** that a repeated unit key is sticky), checks exposure logging +
stats aggregation, batch-evaluates every flag for one context, and validates the 400/409
paths. The unit tests pin the consistent-hash determinism and the weighted split.

CI ([`.github/workflows/c2targetx-ci.yml`](../../.github/workflows/c2targetx-ci.yml)):
path-filtered on `projects/c2-targetx/**`, Postgres + Redis service containers, two jobs
(backend typecheck + migrate + test; frontend build).

---

## Resume one-liners

- Built a **feature-flag / experimentation service**: a rule-evaluation engine (attribute
  conditions, **first-match-wins** ordering), **deterministic percentage rollout via
  consistent hashing** (a user always buckets the same, across servers), A/B **variant
  assignment by weight**, and an evaluation **reason** for debuggability — plus **exposure
  logging** so the experiment split is real data.
- SDK-style **batch evaluation**, a **fail-open Redis flag-config cache** (invalidated on
  every mutation), and a live evaluate playground that shows *why* each user gets each
  variation. Pure logic + `node:crypto` hashing — **zero new runtime deps**, fully
  deterministic, runs offline.

See [`DECISIONS.md`](DECISIONS.md) for the decision log / interview cheat sheet.
