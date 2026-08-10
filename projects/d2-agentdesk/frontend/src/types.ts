export type TicketStatus = 'open' | 'resolved' | 'escalated';

export type Outcome =
  | 'answered_from_kb'
  | 'refund_issued'
  | 'no_order_found'
  | 'refund_failed'
  | 'no_kb_coverage'
  | 'budget_exceeded';

export interface Observation {
  ok: boolean;
  summary: string;
  data: Record<string, unknown>;
}

export interface AgentStep {
  id: string;
  stepNumber: number;
  thought: string;
  action: string;
  actionInput: Record<string, unknown>;
  observation: Observation;
  durationMs: number;
  createdAt: string;
}

export interface TicketListItem {
  id: string;
  customerId: string;
  subject: string;
  status: TicketStatus;
  outcome: Outcome | null;
  stepCount: number;
  runtimeMs: number | null;
  createdAt: string;
}

export interface TicketDetail extends TicketListItem {
  body: string;
  resolution: string | null;
  steps: AgentStep[];
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  product: string;
  amount: number;
  status: 'placed' | 'refunded';
  placedAt: string;
  refundedAt: string | null;
}

export interface AgentDescription {
  planner: string;
  maxSteps: number;
  tools: { name: string; description: string }[];
  terminalActions: string[];
}

export interface AgentStats {
  tickets: number;
  resolved: number;
  escalated: number;
  open: number;
  autonomyRate: number;
  avgSteps: number;
  avgRuntimeMs: number;
  byOutcome: { outcome: string; count: number }[];
  byAction: { action: string; count: number }[];
}

export interface RunResult {
  summary: { ticketId: string; status: TicketStatus; outcome: Outcome; steps: number; runtimeMs: number };
  ticket: TicketDetail;
}

/** Presentation metadata for every outcome the planner can produce. Kept in one table so
 *  the label, tone and one-line explanation never drift apart across views. */
export const OUTCOME_META: Record<Outcome, { label: string; tone: 'ok' | 'warn' | 'danger' | 'info'; blurb: string }> = {
  answered_from_kb: { label: 'Answered from KB', tone: 'ok', blurb: 'Found a confident article and answered from it.' },
  refund_issued:    { label: 'Refund issued',    tone: 'ok', blurb: 'Verified the order, then moved money autonomously.' },
  no_order_found:   { label: 'No order found',   tone: 'warn', blurb: 'Refund requested with no purchase on file — refused to guess.' },
  refund_failed:    { label: 'Refund blocked',   tone: 'warn', blurb: 'The refund tool refused; the agent did not retry blindly.' },
  no_kb_coverage:   { label: 'No KB coverage',   tone: 'warn', blurb: 'No article cleared the confidence bar — declined to improvise.' },
  budget_exceeded:  { label: 'Budget exceeded',  tone: 'danger', blurb: 'Hit the step ceiling without resolving; forced handoff.' },
};

export const STATUS_TONE: Record<TicketStatus, 'ok' | 'warn' | 'muted'> = {
  resolved: 'ok',
  escalated: 'warn',
  open: 'muted',
};

/** Terminal actions are rendered as verdict banners rather than tool cards. */
export const TERMINAL_ACTIONS = ['respond', 'escalate'];
export const isTerminal = (action: string) => TERMINAL_ACTIONS.includes(action);
