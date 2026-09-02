# C2 TargetX — Decision Log / Interview Cheat Sheet

## D1 · Nothing is mocked — the whole engine is real (headline)

Every prior air-gapped project (QAForge, SyncBridge, D1 RAG, E3, A1, A3) had *one* external
thing it had to stub behind an interface — an HTTP endpoint, an embedding model, an LLM
narrator, a webhook target. **TargetX has none.** A feature-flag evaluation engine is pure
logic: clause matching, consistent-hash bucketing, weighted variant assignment, rule
ordering, exposure counting. There is no third party to call, so there is nothing to fake —
the code that runs here is the code that would run in production. That makes it the most
honest artifact in the portfolio: the interview centerpiece (`engine/`) is exercised
identically by the tests, the UI, and any real SDK.

## D2 · Consistent hashing for sticky, server-independent rollouts

A percentage rollout must be **sticky** (a user who is in the 10% stays in the 10% on every
request) and **stateless** (no per-user assignment table). The standard technique, which I
implemented in `engine/bucket.ts`, is to hash `flagKey:unitKey` to a stable point in
`[0,100)` and compare against the cumulative weights. `sha1` gives a well-distributed hash;
I take the first 8 hex digits and divide by `0x100000000` for a uniform `[0,1)` float. Two
consequences fall out for free: the **flag key is part of the hash**, so the same user gets
*independent* buckets across different flags (a user unlucky in flag A isn't systematically
unlucky in flag B); and because it's a pure function of the inputs, **every server computes
the same bucket** with no coordination. A unit test asserts a 50/50 split lands within
40–60% over 2000 units, and the e2e test drives a 34/33/33 split over 300 units.

## D3 · First-match-wins ordered rules + a reason on every result

Targeting is an **ordered** list of rules; the first whose clauses all match (AND) serves,
otherwise the flag falls through. This is the LaunchDarkly model and it's what makes
targeting predictable ("move this rule above that one"). Crucially, `evaluate` returns a
**reason** with every result — `flag_off`, `rule_match:N`, or `fallthrough` — so you can
always answer *why* a user got a variation. The UI surfaces the reason as a colour-coded
badge, which turns the evaluate playground into a debugging tool, and the reason is stored
on every `Exposure` so the stats endpoint can break exposures down by cause.

## D4 · The engine is pure and total (never throws)

`evaluate(flag, ctx)` has no I/O and cannot fail: a disabled flag serves its off variation,
a malformed serve falls back to the off variation, an unknown attribute simply doesn't match
a clause. Being pure means the whole targeting core is unit-testable with plain objects (no
DB, no Redis) — the three engine test files construct `FlagConfig` literals and assert
outcomes. I/O (loading config, caching, logging exposures) lives in the service layer
*around* the engine, exactly like D1 kept its RAG engine pure and the services did the
persistence.

## D5 · Exposure logging is the experiment substrate (and is fail-open)

An A/B result is only real if you record what each unit was actually served. Every
evaluation writes one `Exposure` row (`flagId, unitKey, variationKey, reason, ruleOrder`),
and `GET /api/flags/:key/stats` groups them into per-variation counts + shares — the live
experiment split rendered as the Experiments bar chart. Logging is **fail-open**: a write
error is swallowed so a logging hiccup never breaks an evaluation (a production build would
batch or sample these through a queue — named, not built, per MVP discipline). This is the
same "the audit trail is a first-class artifact" posture as SyncBridge's `AuditEntry` and
D1's `Retrieval`.

## D6 · Fail-open Redis flag-config cache, invalidated on every mutation

Evaluation is the hot path, so assembled flag config (flag + ordered rules) is cached in
Redis by key. The cache is **fail-open** — a Redis outage degrades to a Postgres read, never
an error (same posture as Snipr's cache-aside and D1's answer cache). Correctness comes from
**explicit invalidation**: every create/update/delete and every rule change calls
`invalidateFlag(key)`, so a config change is visible on the next evaluation. I chose explicit
invalidation over a short blind TTL because a flag toggle needs to take effect *now*, not
"within 30s" — the TTL (default 300s) is only a safety net against a missed invalidation.

## D7 · Variations + serve as JSON, validated at the edge with zod

`variations`, `fallthrough`, and a rule's `serve` are stored as `Json` columns rather than
modelled as separate tables. At portfolio scale a flag's variation set is small and always
read as a whole, so a normalized schema would add joins and migrations for no query benefit;
the shapes are instead **validated at the API edge with zod** (e.g. a flag needs ≥2
variations and `offVariationKey` must reference one of them). This keeps the schema small
while the boundary stays type-safe — the same "JSON for cohesive sub-documents, validate on
the way in" call D1 made for embeddings and E3 made for chart specs.

## D8 · Zero new runtime dependencies

The backend deps are the same strict set as the siblings (`express`, `@prisma/client`,
`ioredis`, `zod`, `cors`, `dotenv`) — **no flag-SDK, no hashing library**. Consistent
hashing is `node:crypto` (`sha1`), the engine is pure TypeScript, and the frontend reuses
the established React + Vite + Tailwind + TanStack + Recharts stack. `npm ci` works fully
offline and the air-gap is enforced by the fact that there's simply no external call to make.

## D9 · Port scheme

Postgres 5439 · Redis 6386 · backend 4007 · frontend 5180 · docker-full frontend 8087 —
each +1 from A3 Hooky, so all eight projects' dev stacks run side by side without collisions.
