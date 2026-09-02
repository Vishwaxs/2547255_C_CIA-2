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
| E3 | **InsightDeck** — auto-insight generator from CSV | [`projects/e3-insightdeck`](projects/e3-insightdeck) | CSV type-inference · column profiling · statistical insight detectors (trend · outliers · correlation · …) · automatic chart selection · interestingness ranking | ✅ MVP |
| A1 | **PulseBoard** — real-time metrics dashboard | [`projects/a1-pulseboard`](projects/a1-pulseboard) | Real-time streaming (Server-Sent Events) · Redis sliding-window aggregation · threshold alerting · live time-series + event simulator | ✅ MVP |
| A3 | **Hooky** — webhook gateway / dispatcher | [`projects/a3-hooky`](projects/a3-hooky) | Reliable webhook delivery · HMAC signing · retry with exponential backoff · dead-letter + replay · per-attempt delivery log | ✅ MVP |
| C2 | **TargetX** — feature flags + targeting engine | [`projects/c2-targetx`](projects/c2-targetx) | Rule-based targeting · deterministic percentage rollout (consistent hashing) · A/B variant assignment · flag evaluation with reasons · exposure analytics | ✅ MVP |
| D2 | **AgentDesk** — autonomous support agent | [`projects/d2-agentdesk`](projects/d2-agentdesk) | ReAct loop (Thought→Action→Observation) · tool registry · full step-by-step audit trail · confidence-gated answers · escalation on low confidence or step budget | ✅ MVP |

More projects from the catalog will be added one at a time (D3 EvalForge, E1 AeroPipe, …). See the per-project README for build details.


## Shared design system

Every project's UI runs on one surface language — a dark "instrument panel" theme with an
animated aurora ground, hairline borders, monospace for machine-produced values, and colour
reserved for state rather than decoration.

It lives in `frontend/src/ui/` and is **copied verbatim into each project** rather than
extracted into a package, which keeps every project independently buildable and deployable —
the same self-containment rule the rest of this monorepo follows.

| File | Role |
|---|---|
| `ui/kit.css` | Design tokens, surfaces, controls, state colours, motion keyframes |
| `ui/Aurora.tsx` | Animated background: drifting colour fields, parallax grid, vignette |
| `ui/motion.tsx` | `Reveal`, `ScrambleText`, `CountUp`, `TypeOut` — scroll reveal and text/number animation |
| `ui/controls.tsx` | `SpotlightCard`, `MagneticButton`, `Badge`, `StatusDot`, `SectionLabel` |
| `ui/legacy-theme.css` | Bridge that remaps the older projects' light Tailwind utilities onto the dark tokens |

Two constraints shaped it. **No new dependencies** — every effect is a few lines over
`requestAnimationFrame`, `IntersectionObserver`, and CSS custom properties, so no animation
library was added to nine projects to move a card. And **no forced motion** — every animated
primitive checks `prefers-reduced-motion` and degrades immediately to its final state, so
content is never gated behind an animation that will not play.

The eight projects built before the system existed were retheme'd through
`ui/legacy-theme.css` rather than by editing ~32 shipped panel components. Deleting that one
file reverts any project to its original light theme, which is what makes the bridge safe.
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
    ├── e3-insightdeck/        # Project E3 — see its own README
    ├── a1-pulseboard/         # Project A1 — see its own README
    ├── a3-hooky/              # Project A3 — see its own README
    ├── c2-targetx/            # Project C2 — see its own README
    └── d2-agentdesk/          # Project D2 — see its own README
```
