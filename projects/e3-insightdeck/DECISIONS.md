# E3 InsightDeck — Decision Log / Interview Cheat Sheet

## D1 · The analysis engine is real; only the narrator is mocked (headline)

An "insight generator" sounds like an LLM product. It isn't — the load-bearing
engineering is statistical, not generative: type inference, column profiling, a registry
of insight detectors, interestingness ranking, and chart selection. All of that is real,
deterministic, and runs offline. The one place a model would naturally help — turning a
computed insight into nicer prose — sits behind a `Narrator` interface with a
deterministic `TemplateNarrator` (default) and an `LLMNarrator` stub that throws if
selected (no API key in this air-gapped build). A real LLM narrator drops in at
`ai/narratorFactory.ts` by implementing one method; the detectors, ranking, and charts
never change. Same swap-seam philosophy as D1 RAG's `Embedder`/`Generator` and
SyncBridge's `Connector`.

## D2 · A detector registry, not one big function

Each insight type is a pure function `(frame, cfg) → RawInsight[]` in
`engine/detectors.ts`: trend, top_categories, correlation, outliers, distribution,
dominant_category, missingness, segment_vs_average. They share one typed `Frame` view and
emit a scored insight plus a chart type and a *pre-aggregated* `chartSpec` (so the
frontend renders without re-touching raw rows). Adding a detector is adding one function
to the registry — nothing else changes. This is the same "engine is a registry of small
total functions" instinct as SyncBridge's transform registry.

## D3 · Interestingness ranking (so the deck leads with what matters)

Every detector normalizes its own signal to a `score` in [0,1] — |% change| for trends,
|r| for correlations, top-category share for dominance, deviation magnitude for
outliers/segments, |skew| for distributions. The deck sorts all insights by score and
keeps the top `MAX_INSIGHTS`. Without ranking, an insight deck is just noise; the score is
what makes the *first* card the most worth reading. (Tools like Tableau "Explain Data" and
Sheets "Explore" do the same thing — surface, then rank.)

## D4 · Hand-rolled CSV parser (zero runtime deps)

Parsing CSV correctly — quoted fields, commas and newlines *inside* quotes, escaped `""` —
is a classic place people reach for a library. I wrote a ~70-line RFC-4180-ish state
machine in `engine/parseCsv.ts` instead, unit-tested against all those cases plus CRLF and
ragged rows. The payoff: the backend's runtime dependencies stay a strict subset of the
other projects' (Express/Prisma/ioredis/zod — **no new packages**), so `npm ci` works in
the air-gapped container and there's no parser I can't explain in an interview.

## D5 · Type inference order matters

`inferColumnType` checks boolean → numeric → datetime → categorical/text, and the order is
deliberate: booleans are only explicit `true/false/yes/no` tokens so a `0/1` column stays
**numeric**; numeric is checked before datetime so a bare `2026` is a number, not a date
(and `toDate` additionally requires a date separator). Categorical vs text is decided by
the distinct-value ratio. Getting the order wrong silently mis-types columns and every
downstream detector inherits the mistake — so it's tested explicitly.

## D6 · Rows in a JSON column, analysis in Node (the documented boundary)

`Dataset.rows` is a JSON array and detectors compute over an in-memory `Frame`. The honest
framing: at portfolio scale (hundreds–thousands of rows) this is instant and *portable* —
no extension, runs anywhere, verifiable in CI. It is `O(rows)` per generation and would not
suit millions of rows; the documented scale path is a columnar store (DuckDB / Postgres
analytical queries) behind the same detector interface. Named, not built — MVP discipline.

## D7 · Datasets are immutable; the deck cache is keyed by content

There's no "edit dataset" — a dataset is its CSV, deduped by `sha256(csv)`. So a generated
deck is a pure function of the dataset content + the narrator, and the Redis cache key is
`deck:{contentHash}:{narratorKind}`. Regenerating the same dataset is a **cache hit**
(proven in the e2e test); the cache is **fail-open** (a Redis outage just recomputes, same
posture as Snipr/D1). Each generation still persists a `Deck` row so analytics count it.

## D8 · Chart selection lives with the detector

Each detector picks the chart that fits its finding — line for trends, bar for category
rankings and histograms, scatter for correlations and outliers — and ships the encoding in
`chartSpec` (`data`, `xKey`, `yKeys`, labels). The frontend's `InsightChart` is a thin
switch over `chartType`; it never decides *what* to plot, only *how* to draw the spec it's
given. That keeps the "which chart?" judgment in the analysis layer where the context is.

## D9 · Narration as templates filled from structured detail

The `TemplateNarrator` has one template per insight type, filled from the detector's
`detail` numbers ("revenue rose 784% from … to …", "units and revenue are moderately
positively correlated (r = 0.53)"). It can only state computed facts, so it can't
hallucinate. Because narration is cleanly separated from detection, the LLM narrator is a
pure drop-in: same `detail` in, richer sentence out.

## D10 · Port scheme

Postgres 5436 · Redis 6383 · backend 4004 · frontend 5177 · docker-full frontend 8084 —
each +1 from D1 RAG, so all five projects' dev stacks run side by side without collisions.
