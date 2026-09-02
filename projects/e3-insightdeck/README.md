# E3 InsightDeck — auto-generated insights from your data

Upload a CSV and InsightDeck profiles every column, runs a battery of **statistical
insight detectors**, ranks the findings by how interesting they are, and renders a
**deck of insight cards** — each with an automatically chosen chart and a plain-English
headline. It's a "data analyst as a product": the analysis engine is real; the only
mocked piece is the optional LLM that could write fancier prose.

The portfolio angle: none of the other projects do **automated exploratory data
analysis** — type inference, profiling, an insight-detector registry, chart selection,
and interestingness ranking. That engine is the interesting part, and it's exercised
identically whether headlines come from deterministic templates or a real model.

> **The narrator is swappable; the analysis is real.** This build runs air-gapped with no
> LLM key, so it ships a deterministic `TemplateNarrator` behind a `Narrator` interface. A
> real `LLMNarrator` drops in by implementing the same one method — the detectors, chart
> selection, and ranking never change. See [`DECISIONS.md`](DECISIONS.md).

---

## Architecture

```
  React UI ──► POST /api/datasets              POST /api/datasets/:id/generate
  (TanStack)        │  parse + profile                  │
                    ▼                                     ▼
        ┌──── ingestDataset ─────┐      ┌──────────── generateDeck ─────────────┐
        │ 1. sha256 dedupe        │      │ 0. cache-aside (Redis, fail-open)     │
        │ 2. parseCsv (hand-rolled)│      │ 1. buildFrame (typed column views)    │
        │ 3. inferColumnType      │      │ 2. runDetectors -> RawInsight[]        │
        │ 4. profileColumn        │      │ 3. rank by interestingness, cap N      │
        │ 5. persist Dataset+Cols │      │ 4. Narrator -> headline per insight    │
        └─────────────────────────┘      │ 5. persist Deck + Insight rows         │
                    │                     └────────────────────────────────────────┘
                    ▼                                     ▼
              PostgreSQL (Prisma)                    Redis deck cache
   Dataset(rows Json) · Column(profile) · Deck · Insight(chartSpec Json)
```

The `Narrator` interface is the swap point (selected by `NARRATOR_KIND`). Rows live in a
JSON column and all analysis runs in Node — portable and verifiable with no extension; a
columnar store / DuckDB is the documented scale path.

### Data model

| Model | Key fields |
|---|---|
| `Dataset` | id, name, source, **contentHash** (dedupe), rowCount, columnCount, **rows (Json)** |
| `Column` | id, datasetId, name, index, **inferredType**, nullCount, distinctCount, **stats (Json profile)** |
| `Deck` | id, datasetId, generatedAt, insightCount, narratorKind |
| `Insight` | id, deckId, type, **title** (headline), **score**, chartType, **chartSpec (Json)**, detail, columns, rank |

### Insight detectors

`trend` (a measure over time) · `top_categories` (a measure by a dimension) ·
`correlation` (Pearson over two numerics) · `outliers` (IQR rule) · `distribution`
(skew + histogram) · `dominant_category` (one value covers most rows) · `missingness`
(high-null columns) · `segment_vs_average` (a segment deviating from the overall mean).

Each detector is a pure function emitting a scored insight, a chart type, and a
pre-aggregated `chartSpec`. The deck ranks all of them by interestingness and keeps the
top N (`MAX_INSIGHTS`).

### Type inference

Per column: `numeric` · `categorical` · `datetime` · `boolean` · `text`. Booleans are
only explicit `true/false` tokens (so `0/1` stays numeric); numeric beats datetime (so a
bare year is a number); categorical vs text is decided by the distinct-value ratio.

---

## Run it

### Option A — full stack in Docker (needs Docker daemon)

```bash
cd projects/e3-insightdeck
docker compose -f docker-compose.full.yml up --build
# frontend → http://localhost:8084
# backend  → http://localhost:4004
```

### Option B — host-based dev (Docker for infra only)

```bash
cd projects/e3-insightdeck
docker compose up -d            # Postgres:5436 + Redis:6383

cd backend
cp .env.example .env
npm ci
npm run prisma:migrate:dev
npm run dev                     # http://localhost:4004

cd ../frontend
cp .env.example .env
npm ci
npm run dev                     # http://localhost:5177
```

### Option C — no Docker daemon

```bash
bash scripts/local-services.sh  # Postgres:5436 + Redis:6383 via pg_ctl + redis-server
# then follow Option B from `npm run prisma:migrate:dev`
```

### Try it in 30 seconds (UI)

1. **Datasets** tab → **Seed demo data** (a sales dataset: date, region, category, units, revenue).
2. **Deck** tab → **Generate insights** → a grid of insight cards appears: the revenue
   trend, the units↔revenue correlation, the dominant region, the planted revenue outlier
   (highlighted amber), and more — each with a chart and a headline.
3. **Analytics** tab → totals + an insights-by-type breakdown.
4. Paste your own CSV in **Datasets** and generate a deck for it.

---

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/datasets` | Ingest `{ name, csv }` → parse + infer types + profile. |
| POST | `/api/datasets/seed` | Load the built-in demo dataset. |
| GET  | `/api/datasets` | List datasets with row/column/deck counts. |
| GET  | `/api/datasets/:id` | Dataset + column profiles + a sample of rows. |
| DELETE | `/api/datasets/:id` | Delete (cascades to columns/decks/insights). |
| POST | `/api/datasets/:id/generate` | Run the detectors → build + persist an insight deck. |
| GET  | `/api/datasets/:id/deck` | The latest deck for a dataset. |
| GET  | `/api/decks/:id` | A deck with its insights. |
| GET  | `/api/stats` | datasets/decks/insights totals + insights-by-type. |
| GET  | `/healthz` | Postgres + Redis ping; 200 or 503. |

---

## Tests

```bash
cd backend
npm test   # Jest: 50 tests (parser/infer/stats/profile/detectors/narrator units + e2e)
```

The integration suite drives the real routes with supertest against live Postgres +
Redis and proves it end-to-end with **no network and no API key**
(`NARRATOR_KIND=template`): a seeded dataset is typed correctly, a generated deck contains
ranked, narrated insights (trend/correlation/outliers) with chart-ready specs, a
regeneration is served from **cache**, a quoted CSV is parsed and typed, identical uploads
**dedupe**, and bad input is rejected with **400**.

CI ([`.github/workflows/e3insightdeck-ci.yml`](../../.github/workflows/e3insightdeck-ci.yml)):
path-filtered on `projects/e3-insightdeck/**`, Postgres + Redis service containers, two
jobs (backend typecheck + migrate + test; frontend build).

---

## Resume one-liners

- Built an **automated-insight engine**: CSV type-inference + column profiling, a registry
  of statistical **insight detectors** (trend, top-N, Pearson correlation, IQR outliers,
  skew, dominant-category, missingness, segment-vs-average), **interestingness ranking**,
  and **automatic chart-type selection** — surfaced as a deck of insight cards.
- **Template narration behind a swappable `Narrator` interface** (deterministic default,
  LLM drop-in) so it runs fully offline, plus a hand-rolled RFC-4180 CSV parser and a
  **fail-open Redis deck cache** keyed by the dataset's content hash. **Zero runtime deps**
  beyond Express/Prisma.

See [`DECISIONS.md`](DECISIONS.md) for the decision log / interview cheat sheet.
