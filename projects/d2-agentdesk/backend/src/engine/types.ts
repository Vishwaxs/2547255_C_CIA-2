// The contracts every part of the agent is written against.
//
// The whole design rests on two seams:
//   Tool     — the only way the agent can observe or change the world.
//   Planner  — the only thing that decides what to do next.
//
// The loop in loop.ts knows nothing beyond these two interfaces, which is why the
// deterministic RuleBasedPlanner and an LLM-backed planner are interchangeable without
// touching a single line of orchestration, persistence, or transport code.

/** Uniform result shape every tool returns. This IS the audit substrate: it is what gets
 *  persisted verbatim as an AgentStep's observation, and what the planner reads to decide
 *  its next move. `summary` is the one line a human sees in the trace timeline; `data` is
 *  the structured payload the planner branches on. */
export interface ToolResult {
  ok: boolean;
  summary: string;
  data: Record<string, unknown>;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  run(input: Record<string, unknown>): Promise<ToolResult>;
}

/** A step the agent has already taken this run, as the planner sees it. */
export interface AgentStepLike {
  stepNumber: number;
  thought: string;
  action: string;
  actionInput: Record<string, unknown>;
  observation: ToolResult;
}

export interface PlannerTicket {
  id: string;
  customerId: string;
  subject: string;
  body: string;
}

/** Everything the planner is allowed to look at: the ticket, and what has happened so far.
 *  Note there is no database handle here — a planner cannot reach the world except by
 *  choosing an action and letting the loop execute it. That restriction is what makes the
 *  trace a complete account of the run. */
export interface PlannerContext {
  ticket: PlannerTicket;
  steps: AgentStepLike[];
  /** Names + descriptions of the registered tools. Unused by the rule-based planner, but
   *  it is exactly what an LLM planner would render into its prompt. */
  tools: { name: string; description: string }[];
}

export interface PlannerDecision {
  thought: string;
  /** A registered tool name, or one of TERMINAL_ACTIONS. */
  action: string;
  actionInput: Record<string, unknown>;
}

export interface Planner {
  readonly kind: string;
  decide(ctx: PlannerContext): PlannerDecision | Promise<PlannerDecision>;
}

export const TERMINAL_ACTIONS = ['respond', 'escalate'] as const;
export type TerminalAction = (typeof TERMINAL_ACTIONS)[number];

export function isTerminal(action: string): action is TerminalAction {
  return (TERMINAL_ACTIONS as readonly string[]).includes(action);
}

export const PLANNER_KINDS = ['rule_based', 'llm'] as const;
export type PlannerKind = (typeof PLANNER_KINDS)[number];

/** Machine-readable outcome tags written to Ticket.outcome. Kept separate from the prose
 *  resolution so analytics never has to parse a human sentence. */
export const OUTCOMES = [
  'answered_from_kb',
  'refund_issued',
  'no_order_found',
  'refund_failed',
  'no_kb_coverage',
  'budget_exceeded',
] as const;
export type Outcome = (typeof OUTCOMES)[number];
