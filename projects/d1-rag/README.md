# D1 RAG — retrieval-augmented Q&A over your docs

Add documents, ask questions, get an answer that is **grounded in and cites the exact
chunks it came from** — or a clear refusal when the corpus doesn't contain the answer.
The whole retrieval pipeline (chunking, a vector store, cosine-kNN retrieval, citations,
groundedness) is real; the only thing mocked is the external AI, which lives behind a
swappable interface.

The portfolio angle: none of the other projects touch **retrieval, embeddings, or
grounded generation**. The interesting engineering here is the **RAG engine** — and it
is exercised identically whether the vectors come from an offline TF-IDF embedder or a
real embedding API.

> **The AI is mocked on purpose.** This build runs in an air-gapped environment with no
> embedding/LLM API keys, so it ships a deterministic **TF-IDF `Embedder`** and an
> **extractive `Generator`** behind `Embedder` / `Generator` interfaces. A real
> `OpenAIEmbedder` / `ClaudeGenerator` drops in by implementing the same interface — the
> chunking, retrieval, citation, and refusal engine never changes. See
> [`DECISIONS.md`](DECISIONS.md).

---

## Architecture

```
  React UI ──► POST /api/documents            POST /api/query  { question }
  (TanStack)        │  ingest                        │
                    ▼                                 ▼
        ┌──── ingestDocument ────┐      ┌─────────── answerQuestion ───────────┐
        │ 1. sha256 dedupe        │      │ 0. cache-aside (Redis, fail-open)     │
        │ 2. chunkText (offsets)  │      │ 1. embed query   (Embedder.embed)     │
        │ 3. reindex whole corpus │      │ 2. cosine-kNN vs every chunk vector   │
        │    (Embedder.fit+embed) │      │ 3. threshold gate → contexts          │
        │ 4. persist Chunk rows   │      │ 4. generate + cite (Generator)        │
        └─────────────────────────┘      │    (refuse if nothing clears the bar) │
                    │                     │ 5. persist Query + Retrieval audit    │
                    ▼                     └───────────────────────────────────────┘
              PostgreSQL (Prisma)                         ▼
   Document · Chunk(embedding Json) · Query · Retrieval        Redis answer cache
```

The two `Embedder` / `Generator` interfaces are the swap points: every "AI" is just an
implementation, selected by `EMBEDDER_KIND` / `GENERATOR_KIND`. Embeddings are stored in
a JSON column and cosine-kNN runs in Node — portable and verifiable with no Postgres
extension; **pgvector is the documented scale path**.

### Data model

| Model | Key fields |
|---|---|
| `Document` | id, title, source (`upload`/`paste`/`seed`), **contentHash** (dedupe), charCount, chunkCount |
| `Chunk` | id, documentId, index, text, charStart, charEnd, **embedding (Json `number[]`)**, embedderKind, dimension, tokenCount ·· `@@index([documentId])` |
| `Query` | id, question, answer, refused, **cacheHit**, **topScore**, topK, threshold, latencyMs, embedderKind, generatorKind |
| `Retrieval` | id, queryId, chunkId, score, rank, **cited** ·· `@@index([queryId])` — the per-query audit |

### The RAG engine (real, mock-or-not)

- **Chunking** (`engine/chunk.ts`) — overlapping character windows preserving
  `[charStart, charEnd)` offsets for citation; a shared stopword-filtering tokenizer.
- **Retrieval** (`engine/vector.ts`) — `cosine` (zero-vector safe) + `topKByCosine`
  brute-force ranking over the corpus.
- **Embedders** (`ai/`) — `TfidfEmbedder` (default), `HashingEmbedder` (feature-hashing
  alternative), `OpenAIEmbedder` (stub). All behind one `Embedder` interface.
- **Generators** (`ai/`) — `ExtractiveGenerator` (default; sentence-overlap extractive
  QA with inline `[n]` citations, **refuses** when nothing grounds the answer; cannot
  hallucinate), `ClaudeGenerator` (stub).
- **Grounding / refusal** — a chunk must clear the similarity threshold to become
  generation context; if none does, the system returns "I couldn't find this in the
  provided documents" instead of inventing an answer.
- **Answer cache** — cache-aside on `(corpusVersion, question, topK, threshold)`,
  **fail-open** (a Redis outage degrades to an uncached query). `corpusVersion` is a
  content hash, so adding/removing a document invalidates exactly the right entries.

---

## Run it

### Option A — full stack in Docker (needs Docker daemon)

```bash
cd projects/d1-rag
docker compose -f docker-compose.full.yml up --build
# frontend → http://localhost:8083
# backend  → http://localhost:4003
```

### Option B — host-based dev (Docker for infra only)

```bash
cd projects/d1-rag
docker compose up -d            # Postgres:5435 + Redis:6382

# backend
cd backend
cp .env.example .env
npm ci
npm run prisma:migrate:dev
npm run dev                     # http://localhost:4003

# frontend (new shell)
cd ../frontend
cp .env.example .env
npm ci
npm run dev                     # http://localhost:5176
```

### Option C — no Docker daemon

```bash
bash scripts/local-services.sh  # Postgres:5435 + Redis:6382 via pg_ctl + redis-server
# then follow Option B from `npm run prisma:migrate:dev`
```

### Try it in 30 seconds (UI)

1. **Documents** tab → **Seed demo corpus** (4 short docs: Redis, Postgres, HTTP, Git).
2. **Ask** tab → "What does a 404 status code mean?" → a grounded answer with a clickable
   `[1]` citation that scrolls to the source chunk.
3. Ask "How do I bake sourdough bread?" → **refused** (nothing in the corpus answers it).
4. **History** → open a question to see its full **retrieval audit** (every chunk
   considered, scored, ranked, and whether it was cited). **Analytics** → answered-rate
   and most-cited documents.

---

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/documents` | Ingest `{ title, text, source? }` → chunks + embeds + indexes. |
| POST | `/api/documents/seed` | Load the built-in 4-document demo corpus. |
| GET  | `/api/documents` | List documents with chunk counts. |
| GET  | `/api/documents/:id` | Document + its chunks (text + offsets). |
| DELETE | `/api/documents/:id` | Delete document (cascade) + re-index. |
| POST | `/api/query` | `{ question, topK?, threshold? }` → answer, citations, retrieved[], topScore, latencyMs, cacheHit. |
| GET  | `/api/queries` | Recent query history. |
| GET  | `/api/queries/:id` | One query + its full retrieval audit. |
| GET  | `/api/stats` | answered-rate, cache-hit rate, avg latency, avg top-score, queries-per-day, top-cited docs. |
| GET  | `/healthz` | Postgres + Redis ping; 200 or 503. |

---

## Tests

```bash
cd backend
npm test   # Jest: 35 tests (chunk + vector + embedder + generator units, e2e integration)
```

The integration suite drives the real routes with supertest against live Postgres +
Redis and proves the four behaviours end-to-end with **no network and no API key**
(`EMBEDDER_KIND=tfidf`, `GENERATOR_KIND=extractive`): a seeded corpus answers an
in-corpus question **with a citation**, **refuses** an off-topic one (while still
recording the retrieval audit), serves a repeat question from **cache**, and **busts the
cache** when the corpus changes. A guard test asserts a **409** when stored vectors were
produced by a different embedder than the one querying.

CI ([`.github/workflows/d1rag-ci.yml`](../../.github/workflows/d1rag-ci.yml)):
path-filtered on `projects/d1-rag/**`, Postgres + Redis service containers, two jobs
(backend typecheck + migrate + test; frontend build).

---

## Resume one-liners

- Built a **RAG pipeline** — document chunking with citation offsets, a vector store with
  **cosine-kNN retrieval**, **grounded generation with inline citations**, and a
  **refuse-when-not-found** faithfulness guard — with the external AI behind a swappable
  `Embedder` / `Generator` interface, so it runs fully offline (TF-IDF + extractive) and
  a real embedding/LLM model drops in with **no engine change**.
- Designed a **per-query retrieval audit** (every chunk retrieved, its score, rank, and
  whether it was cited) and a **fail-open Redis answer cache** keyed by a corpus
  content-hash, so repeated questions are served from cache and any corpus change
  invalidates exactly the right entries.

See [`DECISIONS.md`](DECISIONS.md) for the decision log / interview cheat sheet.
