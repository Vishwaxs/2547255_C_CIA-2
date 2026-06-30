# CLAUDE.md — Project Guide for Claude Code

This file is auto-loaded at the start of every Claude Code session in this repo.
Read it before doing anything; it tells you what this repo is, which skills to
use, and where the boundaries are.

## What this repo is

**Portfolio Gap-Filler — a monorepo** of focused, production-minded portfolio
projects. Each project fills one specific capability gap, lives in its own folder
under `projects/`, and ships with its own `README.md` and `DECISIONS.md`.

| # | Project | Folder | Status |
|---|---------|--------|--------|
| A2 | **Snipr** — URL shortener + analytics | `projects/a2-snipr` | ✅ MVP |
| B1 | **QAForge** — API test orchestrator + flaky detection | `projects/b1-qaforge` | ✅ MVP |
| C1 | **SyncBridge** — integration hub (iPaaS-lite) | `projects/c1-syncbridge` | ✅ MVP |
| D1 | **RAG** — retrieval-augmented Q&A over your docs | `projects/d1-rag` | ✅ MVP |
| E3 | **InsightDeck** — auto-insight generator from CSV | `projects/e3-insightdeck` | 🚧 WIP |

More projects get added **one at a time** (A1 PulseBoard, A3 Hooky,
C2 TargetX, …). Always check the per-project `README.md` and `DECISIONS.md` before working in
a project folder.

## Available skills (use these)

Two custom skills load automatically from `.claude/skills/`. (`llm-council` is
also tracked in `skills-lock.json` / `.agents/skills/` by the skills CLI — same
skill, both locations are fine; `.claude/skills/` is what Claude Code reads.)

### `ui-ux-pro-max` — design intelligence
Use for **any UI/UX work** (designing, building, reviewing, or improving an
interface). Before writing UI code, run its engine and apply the output:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<describe the screen>" --design-system
```

It returns a tailored design system: layout pattern, color palette, typography,
UX guidelines, and effects. Treat its recommendations as the design authority
unless the user overrides them.

### `llm-council` — decision pressure-testing
Use for **genuine decisions with real tradeoffs** (architecture, tech-stack,
scope calls). It runs the question through 5 advisor sub-agents that peer-review
each other, then synthesizes a verdict. Triggers:
- `council this`, `run the council`, `war room this`, `pressure-test this`
- Real tradeoff questions: "should I X or Y", "which option", "I'm torn between"

Do **not** trigger it on factual lookups or low-stakes yes/no questions.

## Scope guardrails (stay inside these)

To avoid going out of scope or making unrequested changes:

1. **Stay in the relevant project folder.** Work only within the `projects/<x>`
   that the task is about. Do not modify other `projects/*` unless explicitly
   asked.
2. **MVP-first.** Build the smallest thing that demonstrates the gap, then stop.
   Don't gold-plate or add speculative features.
3. **No surprise dependencies.** Don't introduce new frameworks, libraries, or
   infrastructure that a project doesn't already use without asking first.
4. **Keep projects self-contained.** Each project has its own `package.json`(s),
   `docker-compose.yml`, `.env.example`, `README.md`, and `DECISIONS.md`. Don't
   create cross-project coupling.
5. **Ask before large or destructive changes.** Confirm before big refactors,
   file/dir deletions, dependency upgrades, or anything cross-cutting.
6. **Everything must be explainable.** No line should ship that the author can't
   defend in an interview. Record non-obvious choices in the project's
   `DECISIONS.md`.

## Conventions

- **Commits:** clear, descriptive messages; build one phase per commit where it
  makes sense.
- **Docs:** update the project's `README.md`/`DECISIONS.md` when behavior or
  rationale changes.
- **Branches:** develop on the feature branch you were given; never push to a
  different branch without explicit permission.
