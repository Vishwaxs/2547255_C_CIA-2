# D1 RAG — Decision Log / Interview Cheat Sheet

## D1 · Mock the AI behind a swappable interface, keep the RAG engine real (headline)

A textbook RAG system needs an embedding model and an LLM. This build runs air-gapped
with no API keys (the same constraint QAForge and SyncBridge hit), so neither could be
called or verified. Rather than ship unrunnable code stubbed against OpenAI/Anthropic, I
split the system at two interfaces — `Embedder` and `Generator` — and implemented
**deterministic, offline** versions of each:

- `TfidfEmbedder` (default) + `HashingEmbedder` (alternative) — real vectorizers.
- `ExtractiveGenerator` — real extractive QA that cites and refuses.
- `OpenAIEmbedder` / `ClaudeGenerator` — stubs that throw if selected (no key here).

Why this is the *right* artifact, not a cop-out: the interesting engineering — chunking
with citation offsets, the vector store, cosine-kNN retrieval, threshold-gated
grounding, the citation/audit trail — is exercised **identically** whether the vectors
come from TF-IDF or a hosted model. The engine depends only on the interface; a real
`OpenAIEmbedder` drops in at `ai/embedderFactory.ts` (one `case`) with no engine edit.
It's deterministic and reproducible: anyone can clone and run the full flow, and the
CI/test suite runs with zero credentials. Same philosophy as SyncBridge's `Connector` and
QAForge's local stub server.

## D2 · TF-IDF as the default embedder (not feature-hashing)

Both are offline and deterministic; I made TF-IDF the default because it is the honest,
interpretable IR baseline. Every nonzero dimension maps to a real vocabulary term (no
hash collisions), and IDF visibly down-weights ubiquitous words so retrieval actually
discriminates — a database query ranks the database chunk top in the tests. I used
sklearn's smoothed form `idf = ln((1+N)/(1+df)) + 1`, which never zeroes a vector outright
while still favouring rare, discriminative terms.

I kept `HashingEmbedder` (the "hashing trick" into a fixed dimension) as a documented
contrast: it needs no corpus statistics and bounds memory regardless of vocabulary size
(the streaming/large-vocab path), at the cost of collisions and interpretability.
Implementing and *rejecting* it as the default is itself the point.

**The honest limitation an interviewer should probe:** TF-IDF (and hashing) match on
**lexical overlap only** — no semantics. "car" and "automobile" are orthogonal; a question
phrased differently from the source retrieves poorly. Closing that gap is exactly what a
real embedding model does, behind this same `Embedder` interface. That sentence is the
whole value proposition of the design.

## D3 · TF-IDF means the corpus is re-indexed on every add/delete

TF-IDF's IDF — and therefore every chunk vector — is a function of the *whole* corpus.
So `index.service.ts` re-fits the embedder over all chunks and rewrites every vector
whenever a document is added or removed. This is `O(corpus)` per change, which is fine at
portfolio scale and is the *correct* behaviour (a hashing/OpenAI embedder, having no
corpus statistics, just re-embeds). The query path re-fits over the same chunk texts, so
the query vector always lives in the same space as the stored vectors.

## D4 · Embeddings in a JSON column, cosine-kNN in Node (pgvector is the scale path)

Vectors live in a `Json` column and `topKByCosine` brute-forces cosine in Node. The
reason is portability: pgvector needs a Postgres extension/image that isn't guaranteed in
this air-gapped build, and at this corpus size an exhaustive scan is **sub-10ms**
(measured: `avgLatencyMs` ≈ 8 over the demo corpus). The retrieval interface
(`topKByCosine(queryVec, candidates, k)`) is storage-agnostic, so the documented scale
path is to push the kNN into pgvector's `<=>` operator with an IVFFlat/HNSW index behind
the same function — no engine change. The known boundary: loading every vector into Node
is `O(corpus)` per query; deliberately not built (MVP discipline), just named.

## D5 · Groundedness: refuse instead of hallucinate

The headline trust feature. Retrieval threshold-gates candidates; if none clears the
bar, the generator returns "I couldn't find this in the provided documents." The
`ExtractiveGenerator` can *only* emit sentences pulled from the retrieved chunks, so it
**cannot hallucinate** — a unit test asserts every token in an answer comes from the
source. Off-topic questions refuse (a test confirms `refused: true`, no citations), and
crucially the refusal still records the full retrieval audit ("considered 4 chunks, top
score 0.00, below threshold → refused"), which is what makes the answered-rate metric
meaningful.

## D6 · Stopword filtering in the tokenizer

Early on, an off-topic question ("how do I bake sourdough bread") *answered* instead of
refusing — it matched the corpus on filler words like "how"/"do"/"is". Dropping a small
English stopword list in the shared tokenizer (standard IR preprocessing) fixed both the
retrieval false-positive and the sentence-scoring false-positive, restoring the refusal
guarantee. The tokenizer is shared by the chunker and every embedder, so retrieval and
generation always see the same tokens.

## D7 · Per-query retrieval audit (the SyncBridge audit-log parallel)

Every query persists a `Query` row plus one `Retrieval` row per retrieved chunk, with its
score, rank, and a `cited` flag — even the chunks below threshold, even on a refusal.
This is the trust artifact: you can always answer "what did the system look at, how did it
score, and what did it actually use?" `Query → Retrieval` is deliberately the same shape
as SyncBridge's `SyncRun → AuditEntry`.

## D8 · Fail-open Redis answer cache keyed by a corpus content-hash

Repeated questions are served from a Redis cache, **fail-open** (a Redis error is
swallowed and the query recomputes — same posture as Snipr's cache-aside). The cache key
includes `corpusVersion = sha256(sorted(document.contentHash[]))`, so it invalidates
exactly when the retrievable corpus changes, not on unrelated writes — and re-uploading
identical text (deduped by `contentHash`) is a cache hit. Every query is still persisted
(with `cacheHit: true`) so analytics count cached answers too.

## D9 · Embedder-mismatch guard (a correctness tripwire)

Each chunk stores the `embedderKind` that produced its vector. If `EMBEDDER_KIND` is
changed after a corpus was indexed, cosine would silently compare incompatible vector
spaces and rank garbage. The query path detects the mismatch and returns **409** with a
"re-index or restore the embedder" message instead of serving nonsense. Three lines, and
exactly the kind of silent-corruption bug that's worth guarding.

## D10 · Express + offline mocks = zero new runtime dependencies

Backend deps are a strict subset of SyncBridge's (`express`, `@prisma/client`, `ioredis`,
`zod`, `cors`, `dotenv`) — **no `openai`/`@anthropic-ai` SDK**. The TF-IDF/hashing
embedders and extractive generator are pure TypeScript. This keeps `npm ci` working in
the air-gapped container and means the air-gap is enforced by code (the real clients are
stubs that throw), not by luck. No Playwright either — the supertest suite is the e2e
gate, the frontend is guarded by typecheck + `vite build` (same as the sibling projects).

## D11 · Port scheme

Postgres 5435 · Redis 6382 · backend 4003 · frontend 5176 · docker-full frontend 8083 —
each +1 from SyncBridge, so all four projects' dev stacks run side by side without
collisions.
