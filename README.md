# Portfolio Gap-Filler — Project Monorepo

A set of focused, production-minded portfolio projects, each one chosen to fill a
specific capability gap. Every project lives in its own folder under `projects/`,
ships with its own `README.md` and `DECISIONS.md` (the "why" behind each choice),
and is built MVP-first, one phase per commit.

> **Author:** Vishwas Vashishtha · MCA final-year, CHRIST (Deemed to be University), Bengaluru

## Projects

| # | Project | Folder | Gap it fills | Status |
|---|---------|--------|--------------|--------|
| A2 | **Snipr** — URL shortener + analytics | [`projects/a2-snipr`](projects/a2-snipr) | Caching strategy · read-heavy design · time-series analytics · rate limiting as system design | ✅ MVP |
| B1 | **QAForge** — API test orchestrator + flaky detection | [`projects/b1-qaforge`](projects/b1-qaforge) | Test execution engine · statistical flakiness scoring · test analytics over historical runs | ✅ MVP |
| C1 | **SyncBridge** — integration hub (iPaaS-lite) | [`projects/c1-syncbridge`](projects/c1-syncbridge) | Connecting multiple systems · declarative field-mapping/transform layer · idempotent sync with conflict resolution · per-record audit log | ✅ MVP |
| D1 | **RAG** — retrieval-augmented Q&A over your docs | [`projects/d1-rag`](projects/d1-rag) | Document chunking · vector embeddings · cosine-kNN retrieval · grounded generation with citations · refuse-when-not-found faithfulness | ✅ MVP |
| E3 | **InsightDeck** — auto-insight generator from CSV | [`projects/e3-insightdeck`](projects/e3-insightdeck) | CSV type-inference · column profiling · statistical insight detectors (trend · outliers · correlation · …) · automatic chart selection · interestingness ranking | 🚧 WIP |

More projects from the catalog will be added one at a time (A1 PulseBoard,
A3 Hooky, C2 TargetX, …). See the per-project README for build details.

## Conventions

- **Monorepo, one folder per project** under `projects/`.
- Each project is **self-contained**: its own `package.json`(s), `docker-compose.yml`,
  `.env.example`, README and DECISIONS log.
- **MVP-first**: build the smallest thing that demonstrates the gap, then stop.
- **Explainable**: no line ships that the author can't defend in an interview.

## Repository layout

```
.
├── README.md                 # this file
├── DECISIONS.md              # cross-cutting decisions (monorepo, branching)
├── .github/workflows/        # CI per project (path-filtered)
└── projects/
    ├── a2-snipr/             # Project A2 — see its own README
    ├── b1-qaforge/           # Project B1 — see its own README
    ├── c1-syncbridge/        # Project C1 — see its own README
    ├── d1-rag/               # Project D1 — see its own README
    └── e3-insightdeck/        # Project E3 — see its own README
```
