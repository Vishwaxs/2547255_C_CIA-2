# Snipr — decision log / interview cheat sheet

Every choice here is one I can defend out loud. The format is: what I picked,
what I rejected, and why — plus the question an interviewer would actually ask.

---

## 1. Cache-aside, not write-through or read-through

**Picked:** Cache-aside (lazy loading). On a redirect, check `link:{code}` in
Redis; on a miss, read Postgres and populate the cache with a TTL.

**Rejected:** Write-through (write cache + DB synchronously on create) and
read-through (cache library owns the DB fetch).

**Why:** Links are written once and read potentially millions of times, and most
links are never popular. Write-through would cache every created link, including
the long tail that never gets a click — wasted memory. Cache-aside only caches
links that are actually requested, and the TTL evicts cold entries for free.
Targets are immutable for a given code, so staleness isn't a concern; the TTL
exists for memory reclamation, not correctness.

**They'll ask:** *"What about a thundering herd if a viral link expires?"* —
Acceptable here: a miss is a single indexed primary-key lookup (~2.5 ms p95
measured), not an expensive query. If it mattered I'd add a short
single-flight lock or probabilistic early refresh. I deliberately did **not**
build that — it's gold-plating for this scale.

---

## 2. Buffered async click writes, not synchronous inserts

**Picked:** The redirect issues the 302, then `RPUSH`es a click event onto
`buf:clicks` and returns. A `setInterval` loop (`FLUSH_INTERVAL_MS`) drains the
list with batched `LPOP` and writes all clicks + counter updates in a single
Prisma `$transaction`.

**Rejected:** `INSERT` one `Click` row per redirect on the request path.

**Why:** A redirect's job is to redirect fast. Putting a DB write in that path
couples user-facing latency to write throughput and makes the redirect fail if
the DB is briefly slow. Buffering moves the write off the hot path and amortizes
it — N clicks become one batched transaction instead of N round-trips.

**They'll ask:** *"You lose clicks if the process dies before a flush."* —
Correct, and that's an accepted trade. Analytics are not billing; approximate
counts are fine. On `SIGTERM`/`SIGINT` I stop the loop and flush the remainder,
so a graceful shutdown loses nothing; only a hard crash drops the in-flight
buffer. If exactness were required I'd use a durable queue (Redis Streams with
consumer-group acks, or Kafka) instead of a plain list.

---

## 3. Random base62 codes, not sequential base62 of the auto-increment ID

**Picked:** Generate a random 7-char base62 code with `crypto.randomInt` (no
modulo bias), retry on the rare unique-constraint collision (Postgres `P2002`).

**Rejected:** Encode the row's auto-increment integer ID as base62 (the textbook
"bijective" approach).

**Why:** Sequential codes are enumerable — `/aaaab` follows `/aaaaa`, so anyone
can scrape every link and leak how many you've created (a competitive-intel
leak). Random codes over a 62^7 ≈ 3.5-trillion keyspace make enumeration
infeasible and keep creation counts private. The cost is collision handling,
which is a bounded retry loop that effectively never fires at this fill level.

**They'll ask:** *"Won't collisions get expensive as the table fills?"* — Not
near-term. Collision probability is (used / 3.5e12); even at 10M links that's
~3e-6 per attempt. If fill ever got high I'd widen the code length, which costs
one character.

---

## 4. Hand-rolled fixed-window rate limiter, not a black-box library

**Picked:** Per request, `INCR rl:{scope}:{ip}:{bucket}` where `bucket` is the
current window; set `EXPIRE` on first hit. Over the max → 429. Redis errors →
**fail open** (allow the request).

**Rejected:** A drop-in middleware like `express-rate-limit`, and a
sliding-window / token-bucket algorithm.

**Why:** A self-rule I held to on this project is *every line is explainable* —
a hand-rolled limiter means I can whiteboard the exact Redis ops. Fixed-window
is the simplest correct-enough choice: two Redis commands, O(1) memory per
window. Fail-open is deliberate — a rate limiter protects against abuse, but it
must not take down redirects if Redis blips; availability of the core product
beats strict enforcement.

**They'll ask:** *"Fixed-window allows a 2× burst at the boundary."* — True: up
to `max` at the end of one window and `max` at the start of the next. Acceptable
for abuse-prevention (not financial). Sliding-window log or token bucket fixes
it at the cost of more state/commands; I'd reach for that only if boundary
bursts were causing real harm.

---

## 5. Denormalized `clickCount` on `Link`

**Picked:** Keep a `clickCount` integer on `Link`, incremented during the flush,
alongside the normalized `Click` rows.

**Why:** The list/dashboard view shows a count per link. Aggregating
`COUNT(*)` over `Click` on every list render would scan growing history. The
denormalized counter makes the list O(rows shown); the `Click` table still backs
the detailed time-series stats. The flush already touches both in one
transaction, so they stay consistent without a second write path.

---

## 6. `geoip-lite` (offline) for country, not a geo API

**Picked:** Resolve IP→country with the bundled offline `geoip-lite` database.

**Why:** No API key, no network call on the (already async) click path, no
per-request cost or rate limit, and it works in an air-gapped container — which
is exactly where this was built and verified. Country-level accuracy is plenty
for a referrer/geo breakdown. A paid geo-IP service would add latency,
dependency, and cost for precision the dashboard doesn't need.

---

## 7. Express, not NestJS (deviation from the original plan)

**Picked:** Plain Express + TypeScript with hand-built middleware
(`validate`, `rateLimit`, `errorHandler`).

**Rejected:** NestJS (which the initial plan named).

**Why:** For a service this size, Nest's module/DI machinery is ceremony that
obscures the parts worth showing — the cache-aside resolve, the buffer flush,
the limiter. Express keeps those front-and-center and every middleware is ~30
readable lines I wrote, which serves the "explain every line" goal better than a
framework-generated structure. Validation is explicit via Zod
(`validateBody`), so I don't lose type-safe DTOs.

---

## 8. supertest integration suite as the e2e gate, not Playwright

**Picked:** Jest + supertest hitting the real app against live Postgres + Redis,
asserting the load-bearing behaviors (MISS→HIT, flush persistence, 4xx/429).

**Rejected:** Playwright browser e2e.

**Why:** Honest reason — the Playwright browser binary download is blocked by
this environment's network egress allowlist, so a browser e2e couldn't be run or
verified here, and I won't ship a test I can't execute. The API-level suite
covers the actual system-design claims (caching, buffering, limiting) more
directly than a UI click-through would, and runs in CI against service
containers. The frontend is guarded by a typecheck + production build in CI.

---

## Things I deliberately did **not** build (MVP discipline)

- Single-flight / lock on cache miss — unnecessary at this scale (cheap misses).
- Sliding-window rate limiting — fixed-window is correct-enough for abuse.
- Durable click queue (Streams/Kafka) — plain list is fine for approximate
  analytics; graceful shutdown already flushes.
- User accounts / auth — out of scope for the system-design story this project
  is meant to tell.

Each of these is a one-sentence answer to *"how would you extend this?"* rather
than something half-built and unexplained.
