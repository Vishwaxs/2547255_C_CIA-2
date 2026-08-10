# D2 AgentDesk — Decision Log / Interview Cheat Sheet

## D1 · The ReAct loop is the product, so the loop knows nothing

The whole point of this project is the machinery around a decision, not the decision itself.
So `engine/loop.ts` is deliberately ignorant: it cannot tell a refund from a knowledge-base
lookup, it does not know which tools exist, and it has no opinion about what a good answer
is. It asks a `Planner` for one decision, executes it through a `ToolRegistry`, persists
what happened, and repeats until a terminal action or the step ceiling.

That ignorance is what makes everything else swappable. Adding a capability is one
`registry.register(...)` line. Replacing the brain is one factory case. Neither touches
orchestration, persistence, or transport. The alternative — a service that knows the refund
workflow — would have been quicker to write and impossible to extend without editing the
same function every time.

## D2 · The planner is an interface with a deliberately throwing LLM implementation

There is no API key and no egress in this build, so the working planner is deterministic.
The temptation was to write a "mock LLM" that returns canned decisions and call it an
integration. That would be a lie in code, and the sort of thing that falls apart in an
interview the moment someone asks what happens when you set `PLANNER_KIND=llm`.

Instead `LlmPlanner.decide()` throws a 501 that names exactly what is missing, and
`buildPlannerPrompt()` is fully implemented — you can read the precise prompt the model
would receive, including the tool list and the serialized step history, and see that the
return shape is the same `PlannerDecision` the rule-based planner produces. The seam is
demonstrable without pretending it is wired. This mirrors D1 RAG's `Embedder`/`Generator`
stubs; same honesty policy applied to a different dependency.

## D3 · The planner branches on observations, not a step counter

`RuleBasedPlanner` decides by asking "what have I already seen?" — has `lookup_order`
returned yet, did `issue_refund` succeed — rather than "which step number is this?".

It costs nothing extra and buys resumability for free. `runAgentLoop` rehydrates prior
`AgentStep` rows into the planner context on every call, so a run interrupted halfway
continues correctly instead of restarting and re-issuing a refund. A step-counter state
machine would have needed separate bookkeeping to survive the same interruption.

## D4 · `{ok, summary, data}` is the audit substrate, not a convenience shape

Every tool returns the same three fields and that triple is persisted verbatim as the step's
observation. `summary` is the line a human reads in the timeline; `data` is what the planner
branches on; `ok` is the honest success signal.

The consequence worth noting: `ok:false` is used for *facts*, not just errors. "This
customer has no orders" is a successful query and a failed premise, and the planner needs to
treat it as the second. Modelling it as an empty-but-ok list would have made the escalation
branch depend on inspecting array lengths scattered through the planner instead of one
consistent flag.

## D5 · A confidence bar, added after the agent got it wrong

The first working version answered *"do you offer student internships?"* by quoting an
article about updating your email address. Both texts contain the word "takes"; it scored 1,
and since nothing else matched at all, it ranked first and was treated as the answer.

That is precisely the failure this project claims to be about avoiding, so the fix is
architectural rather than a tuned constant. `kbSearch` now separates two questions:
`rankArticles` answers "what matched", `meetsConfidence` answers "is the best match good
enough to answer from". The bar is two conditions because they catch different failures — a
minimum score rejects a lone glancing hit, and a minimum count of distinct matched terms
rejects one repeated word carrying the score alone. Either alone is gameable by the other's
failure case.

The rejected candidate is returned in `data.rejected` rather than dropped, and the planner
names it in its thought. A refusal you can inspect is worth far more than a silent filter,
and it turned the project's most embarrassing bug into its most interesting demo moment.

Both thresholds are env-tunable (`KB_MIN_SCORE`, `KB_MIN_TERMS`) because the right values
depend on knowledge-base size and writing style, and hardcoding them would hide that.

## D6 · Keyword scoring, not embeddings

`search_kb` is weighted keyword overlap: title hits count 3, tag hits 2, body hits 1. No
stemming, no vectors, no model.

Reaching for embeddings here would reintroduce exactly the dependency the planner was
designed to avoid, for a knowledge base of five articles. What the demo needs from retrieval
is a *meaningful* separation between "the KB answers this" and "it doesn't", so the
escalation branch is real rather than theatre — and plain scoring plus an explicit
confidence bar delivers that while staying fully unit-testable and explainable line by line.
The weights are ordered by how much signal each field carries for a short support query, not
tuned to make the demo pass.

## D7 · Refunds are idempotent at the database, not in an `if`

`issue_refund` is the only tool that changes anything, so it is the only one that must be
safe to run twice. The naive version — read the order, check `status !== 'refunded'`, update
— has a race between the read and the write.

The shipped version runs the check and the update in one transaction, and the update carries
`where: { id, status: 'placed' }`. A second concurrent run updates zero rows and reports the
conflict. The tool returns `ok:false` for an already-refunded order rather than treating it
as a no-op success, because the planner needs to tell "this refund can't proceed" from "it
worked" — and that distinction is what produces the `refund_failed` escalation instead of a
cheerful confirmation of a refund that never happened.

## D8 · Creating a ticket does not run the agent

`POST /api/tickets` creates; `POST /api/tickets/:id/run` runs. A single endpoint that did
both would be less code and a worse project: the reviewer would file a ticket and receive a
finished answer, having seen none of the reasoning that is the entire point.

Splitting them also makes the 409 guard meaningful (re-running a finished ticket is a
conflict, not a silent restart that could re-trigger side effects) and makes resume a real
operation rather than a theoretical one. The one exception is the demo seed, which runs each
ticket it creates — someone pressing "Seed demo" wants five finished traces to read, not
five empty queues.

The loop is synchronous because it is: the deterministic planner finishes in single-digit
milliseconds and each step is one small query. No queue, no worker, no polling. A3 Hooky is
asynchronous because it models network retry backoff; there is nothing here that needs it,
and adding it would be infrastructure for its own sake.

## D9 · The step ceiling force-escalates instead of throwing

`AGENT_MAX_STEPS` defaults to 6 against a longest real path of 3. When it is hit, the loop
does not error — it writes a final `escalate` step with `budget_exceeded` and moves the
ticket to `escalated`.

A stuck `open` ticket that nobody is working is the worst outcome for a support queue, worse
than a wrong answer, because nothing surfaces it. Every terminating condition, including
failure, leaves the ticket in a defined state with a human attached. The ceiling is
env-configurable and also injectable per-run, which is how the test drives it with a stub
planner that never terminates — the one branch no real ticket can reach.

## D10 · `engine/` here contains I/O, unlike TargetX

C2 TargetX uses `engine/` to mean "pure, no I/O". This project breaks that convention: its
tools read and write Postgres, because a support agent that cannot touch the world is not a
support agent.

Flagging it rather than silently diverging. Here `engine/` means "the agent's own code, as
opposed to Express plumbing". The purity that mattered was preserved where it counts — the
planner, the scoring, and the intent classifier are all pure and tested without a database;
only the tools and the loop do I/O.

## D11 · Redis earns its place, barely

Every sibling project has a Postgres + Redis health check, and the honest risk was Redis
being decorative here. It caches the knowledge-base article set, which `search_kb` reads on
every question-intent ticket, behind a fail-open wrapper: `lazyConnect` so startup never
blocks, and every call site swallows errors so an outage degrades to a Postgres read rather
than failing a request.

That is a real if modest use. It is called out because "we added Redis because the template
had Redis" is not a defensible answer, and the cache being fail-open is the part that
matters — a cache that can fail a request is a liability, not an optimization.

## D12 · The UI kit is hand-written, and shared across the monorepo

The interface needed to look like an instrument, not a landing page, and the reasoning trace
needed to be genuinely readable. That meant real motion: scroll reveals, a typing effect on
the agent's thoughts, count-up statistics, cursor-tracked highlights, magnetic buttons.

Framer Motion would have been the obvious reach. It was not used, for two reasons. Every one
of these effects is a handful of lines over `requestAnimationFrame`, `IntersectionObserver`,
and CSS custom properties — the library would have cost more bundle than it saved code. And
the monorepo's standing rule is no surprise dependencies; adding one to nine projects at
once to animate a card is not a trade worth making.

`src/ui/` is deliberately project-agnostic and copied verbatim into every sibling, along
with `ui/kit.css`, so the whole portfolio shares one surface language. Duplication over a
shared package is the same call the rest of this monorepo makes: each project stays
independently buildable and deployable, which is worth more here than deduplicating ~400
lines.

Every animated primitive checks `prefers-reduced-motion` and degrades to its final state
immediately. Content is never gated behind an animation that will not play, and the scramble
effect keeps the real string in the accessibility tree while only the visual layer scrambles.

One bug worth recording: `@import './ui/kit.css'` was originally placed *after* the
`@tailwind` directives. CSS requires `@import` to precede all other rules, and Tailwind
expands its directives into real rules — so the import was invalid and silently dropped,
taking every design token with it. The build passed and the page rendered completely
unstyled. It now sits at the top of `index.css` with a comment explaining why it must stay
there.

## D13 · Port scheme

Backend `4008`, Postgres `5440`, Redis `6387`, Vite dev `5181`, full-compose frontend `8088`
— each +1 from C2 TargetX, so all nine projects' dev stacks run side by side without
clashing. The ports appear in `.env.example`, `docker-compose*.yml`,
`scripts/local-services.sh`, `src/__tests__/setup.ts`, and the CI workflow, and those five
places must agree.
