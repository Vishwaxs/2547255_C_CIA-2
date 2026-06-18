# Decisions — Monorepo level

Cross-cutting choices that apply to the whole repository. Per-project decisions live
in each project's own `DECISIONS.md`.

## Why a monorepo (one folder per project)?

The portfolio is a *series* of small, independent projects that share no runtime code.
A monorepo keeps them discoverable in one place, lets a single CI file fan out with
path filters, and avoids the overhead of managing many repositories. Each project is
fully self-contained (its own dependencies, compose file, env) so it can still be
lifted out into its own repo later with zero coupling.

## Why one branch / one PR for this work?

The grading/workflow constraint pins development to a single feature branch
(`claude/portfolio-gap-filler-catalog-cegdtf`). Within that branch each build **phase
is its own commit** with a clear message, so the history still reads as a phased build
even though it lands as one PR.

## Why MVP-first, with a DECISIONS log per project?

The guiding rule for this portfolio is *"a finished tight project beats an unfinished
ambitious one."* Each project targets the **minimum** scope that genuinely demonstrates
the capability gap it is meant to fill, and records the reasoning in `DECISIONS.md` so
it doubles as an interview cheat sheet. No metric is ever borrowed from another
project — only numbers measured on this code are quoted.
