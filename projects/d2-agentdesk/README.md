# D2 AgentDesk — autonomous support agent with a full audit trail

A support-desk agent that works a ticket the way a person would: it thinks, picks a tool,
looks at what came back, and decides again — until it either answers the customer or hands
off to a human. Every one of those cycles is written to Postgres, so a finished ticket is
not just an outcome, it is a complete record of how the agent got there.

**The gap this fills.** Plenty of projects call a model once and print the reply. Far fewer
show the part that actually matters in production: a **multi-step ReAct loop**
(Thought → Action → Observation), a **tool registry** that is the agent's only route to the
outside world, a **step-by-step trace** you can audit after the fact, and **escalation** when
the agent runs out of confidence or budget. This project is about that machinery.

**It runs offline, on purpose.** There is no API key and no egress here, so the planner —
the agent's decision-making brain — is deterministic and dependency-free. It sits behind a
`Planner` interface and consumes exactly what an LLM planner would consume (the ticket plus
the full step history) and returns exactly what one would return (`{thought, action,
actionInput}`). Swapping in a real model is one file. The seam is real, and
`buildPlannerPrompt()` renders the exact prompt the model would receive, so you can read it
without a key.

## Architecture

```
    POST /api/tickets/:id/run
              │
              ▼
    ┌───────────────────┐   decide(ticket, steps, tools)   ┌──────────────────┐
    │   engine/loop.ts  │ ───────────────────────────────► │     Planner      │
    │                   │                                  │  rule_based │ llm │
    │   Thought         │ ◄─────────────────────────────── └──────────────────┘
    │     ↓             │      {thought, action, input}
    │   Action  ────────┼──────────────┐
    │     ↓             │              ▼
    │   Observation     │      ┌────────────────┐    ┌──────────────────────┐
    │     ↓             │ ◄─── │  ToolRegistry  │───►│  search_kb           │
    │   (repeat)        │      └────────────────┘    │  lookup_order        │
    │     ↓             │                            │  issue_refund        │
    │  respond|escalate │                            └──────────────────────┘
    └─────────┬─────────┘                                      │
              │ every cycle persisted before the next begins    ▼
              ▼                                       KnowledgeArticle / Order
        AgentStep rows  ──►  the audit trail             (the mock world)
```

The loop knows nothing about refunds, articles, or which tools exist. It knows how to ask a
planner for one decision, run it through the registry, write down what happened, and stop.
Everything domain-specific lives in a tool or in the planner.

### Data model

| Model | Purpose | Notes |
|---|---|---|
| `Ticket` | The unit of work | `status` open/resolved/escalated, plus a machine-readable `outcome`, denormalized `stepCount` and `runtimeMs` |
| `AgentStep` | One Thought→Action→Observation cycle | `thought`, `action`, `actionInput` (Json), `observation` (Json), `durationMs`. Unique on `(ticketId, stepNumber)` |
| `KnowledgeArticle` | What `search_kb` reads | `tags` as Json string[] |
| `Order` | What `lookup_order` reads and `issue_refund` mutates | `status` placed/refunded |

### The planner's five branches

The rule-based planner is a state machine over *what has already been observed*, not over a
step counter — which is why a resumed run continues correctly from persisted history.

| Situation | Path | Outcome |
|---|---|---|
| Question the KB covers confidently | `search_kb` → `respond` | `answered_from_kb` |
| Refund, refundable order exists | `lookup_order` → `issue_refund` → `respond` | `refund_issued` |
| Refund, no orders on file | `lookup_order` → `escalate` | `no_order_found` |
| Refund, order already refunded | `lookup_order` → `issue_refund` (refused) → `escalate` | `refund_failed` |
| Question the KB cannot answer | `search_kb` → `escalate` | `no_kb_coverage` |
| Planner never terminates | budget ceiling → forced `escalate` | `budget_exceeded` |

### Two guards worth pointing at

**A confidence bar on knowledge-base answers.** Ranking alone is not enough to answer from.
An early version of this happily answered *"do you offer student internships?"* by quoting
an article about changing your email address — the two texts shared the word *"takes"*,
which scored 1 and ranked first because nothing else matched at all. `search_kb` now
separates relevance from sufficiency: a hit must clear both a minimum score and a minimum
number of distinct matched terms. Below that it reports failure and carries the near-miss
in `rejected`, so the trace shows what the agent considered and refused rather than hiding
the filter. See `engine/kbSearch.ts`.

**A fail-closed refund classifier.** The refund branch can move money and the question
branch cannot, so the two are not interchangeable and the classifier is deliberately
asymmetric. An earlier version matched the bare word "refund" anywhere in the ticket, which
meant *"What is your refund policy?"* — a question from someone who had not decided to buy
yet — routed straight to `lookup_order`, found a perfectly good order, and refunded it.
Mentioning a refund is not the same as asking for one. `classifyIntent` now requires an
explicit request: an imperative, a first-person want, or a phrase that is only ever a demand.
See `engine/intent.ts`.

**Idempotent refunds.** `issue_refund` is the only tool that mutates anything, so it is the
only one that has to be safe run twice. The check and the update happen in one transaction
with a status precondition, so two concurrent runs cannot both refund the same order — the
second updates zero rows and reports the conflict honestly instead of double-refunding and
returning success.

## Run it

### Option A — full stack in Docker

```bash
docker compose -f docker-compose.full.yml up --build
# frontend  http://localhost:8088
# backend   http://localhost:4008
```

The backend image runs as a non-root user and applies pending migrations before starting.
It invokes the Prisma CLI by path rather than through `npx`: the CLI survives
`npm ci --omit=dev` only because `@prisma/client` declares it as an optional peer, and if
that ever stops being true `npx` would silently fetch an unpinned CLI from the registry at
boot instead of failing. Compose files are validated in CI; the production image layout —
`npm ci --omit=dev`, the copied client, `migrate deploy`, then `node dist/server.js` — was
replayed outside Docker and confirmed to boot, migrate and serve.

### Deploy it (Vercel + Supabase)

```bash
bash scripts/deploy-vercel.sh
```

One script, run from your own machine so your logins are the ones used. It signs you into
Vercel (opening your real browser), reads the Supabase database password without echoing or
storing it, creates both Vercel projects, sets their environment variables, deploys the API,
points the UI at it via rewrites, deploys the UI, then seeds the demo and fails loudly unless
all five planner branches are reached against the live database.

The Supabase project, schema and RLS already exist. The password is the only value the
Supabase management API will not return, which is why the script asks for it rather than
fetching it.

`REDIS_URL` is deliberately left unset in production: serverless has no Redis, and the cache
is fail-open, so the deployed API reports `redis: "not_configured"` and runs at full speed
without it. The UI treats that as healthy rather than degraded.

### Option B — dev infra in Docker, app on the host

```bash
docker compose up -d                      # Postgres :5440, Redis :6387
cd backend  && cp .env.example .env && npm install && npx prisma migrate dev && npm run dev
cd frontend && cp .env.example .env && npm install && npm run dev   # http://localhost:5181
```

### Option C — no Docker daemon

```bash
bash scripts/local-services.sh            # starts Postgres :5440 + Redis :6387 directly
cd backend && npm install && npx prisma migrate dev && npm run dev
```

### Try it in 30 seconds

1. Open http://localhost:5181 and press **Seed demo**. Five tickets load and run
   immediately — one per planner branch.
2. Open **Refund for my keyboard**: three steps, ending in a real refund.
3. Open **Do you offer student internships?**: the agent finds a weak match, names it, and
   refuses to answer from it.
4. Switch to **World** and confirm the mechanical keyboard is now `refunded` — the agent
   actually moved that state.
5. Press **New ticket**, file one of your own, then press **Run agent** and watch the loop
   go.

## API

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/tickets` | Create a ticket. Does **not** run the agent |
| `GET` | `/api/tickets?status=` | List, optionally filtered by status |
| `GET` | `/api/tickets/:id` | Ticket plus its full ordered trace |
| `POST` | `/api/tickets/:id/run` | Run or resume the loop. `409` if already finished |
| `DELETE` | `/api/tickets/:id` | Delete a ticket; its trace cascades |
| `POST` | `/api/seed` | Idempotent demo seed; auto-runs each new ticket |
| `GET` | `/api/world/kb` | Knowledge base contents |
| `GET` | `/api/world/orders?customerId=` | Order system contents |
| `GET` | `/api/world/agent` | Active planner, step ceiling, registered tools |
| `GET` | `/api/world/stats` | Outcome/action rollup and autonomy rate |
| `GET` | `/healthz` | Postgres + Redis probe, `200`/`503` |

Creating and running are deliberately separate. A form that returns a fully-resolved ticket
hides the only interesting part; here you file it, then trigger the loop and watch it.

## Tests

```bash
cd backend && npm test     # 72 tests across 5 suites
```

- `kbSearch` / `intent` — pure scoring, tokenization, the confidence bar, and the
  fail-closed refund classifier, no database.
- `planner` — all five branches driven by hand-built observation histories, plus the LLM
  seam's 501 and the prompt it would send.
- `loop` — real database: the seeded scenarios end to end, the 409/404 guards, a stub
  planner that never terminates hitting the budget ceiling, an unregistered tool being
  recorded rather than crashing, and refund idempotency.
- `api` — the full HTTP surface through supertest.

CI runs typecheck plus the whole suite against real Postgres and Redis services on every
push touching this project — see `.github/workflows/d2agentdesk-ci.yml`.

## Resume one-liners

- Built a ReAct-style agent loop (Thought→Action→Observation) with a pluggable tool registry
  and a step-budget ceiling that force-escalates rather than looping, persisting every cycle
  to Postgres as a replayable audit trail.
- Designed the planner as an interface so a deterministic offline implementation and an
  LLM-backed one are interchangeable without touching orchestration, persistence, or
  transport — the swap is one file.
- Added a two-condition confidence bar to knowledge-base retrieval after finding the agent
  answering an unrelated question from a single coincidental word match, and surfaced the
  rejected candidate in the trace so refusals are auditable.
- Made the only state-mutating tool idempotent under concurrency with a transactional
  status precondition, so a double-run reports a conflict instead of double-refunding.
- Shipped a dark, motion-aware React 18 + TanStack Query UI that renders the reasoning trace
  as a step timeline, backed by 72 tests and path-filtered GitHub Actions CI.

Design rationale and the trade-offs behind each of these live in [DECISIONS.md](DECISIONS.md).
