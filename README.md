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
| B1 | **QAForge** — API test orchestrator + flaky detection | [`projects/b1-qaforge`](projects/b1-qaforge) | Test execution engine · statistical flakiness scoring · test analytics over historical runs | 🔨 WIP |

More projects from the catalog will be added one at a time (C1 SyncBridge,
D1 RAG, E3 InsightDeck, A1 PulseBoard, …). See the per-project README for build details.

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
    └── b1-qaforge/           # Project B1 — see its own README
```
