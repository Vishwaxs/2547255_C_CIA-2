import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { HttpError } from '../middleware/errorHandler';
import {
  AgentStepLike,
  Outcome,
  Planner,
  PlannerDecision,
  ToolResult,
  isTerminal,
} from './types';
import { plannerFor } from './plannerFactory';
import { buildRegistry } from './toolRegistry';

// The ReAct loop.
//
//   Thought -> Action -> Observation -> (repeat) -> respond | escalate
//
// Every cycle is persisted before the next one begins, so the trace is durable even if the
// process dies mid-run, and a run is always resumable from whatever is in the database.
// The loop itself is deliberately dumb: it does not know what a refund is, what the
// knowledge base contains, or which tools exist. It knows how to ask a Planner for one
// decision, execute it through the ToolRegistry, write down what happened, and stop.

export interface RunOptions {
  planner?: Planner;
  maxSteps?: number;
}

export interface RunSummary {
  ticketId: string;
  status: 'resolved' | 'escalated';
  outcome: Outcome;
  steps: number;
  runtimeMs: number;
}

/** Terminal actions get a synthetic observation so every step in the trace has the same
 *  shape. A reader should never have to special-case the last row. */
function terminalObservation(decision: PlannerDecision): ToolResult {
  return decision.action === 'respond'
    ? { ok: true, summary: 'Replied to the customer and closed the ticket.', data: {} }
    : {
        ok: true,
        summary: `Handed off to a human agent (${String(decision.actionInput.reason ?? 'unspecified')}).`,
        data: {},
      };
}

function outcomeFor(decision: PlannerDecision): Outcome {
  if (decision.action === 'respond') {
    return (decision.actionInput.outcome as Outcome) ?? 'answered_from_kb';
  }
  return (decision.actionInput.reason as Outcome) ?? 'no_kb_coverage';
}

function resolutionFor(decision: PlannerDecision): string {
  return String(
    decision.actionInput.message ?? decision.actionInput.detail ?? decision.actionInput.reason ?? '',
  );
}

export async function runAgentLoop(
  ticketId: string,
  { planner = plannerFor(), maxSteps = env.AGENT_MAX_STEPS }: RunOptions = {},
): Promise<RunSummary> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  if (ticket.status !== 'open') {
    // Idempotency guard, mirroring issue_refund's posture: re-running a finished ticket is
    // a conflict, not a silent restart that would duplicate side effects like refunds.
    throw new HttpError(409, `Ticket is already ${ticket.status}; there is nothing to run`);
  }

  const registry = buildRegistry();
  const tools = registry.list();
  const startedAt = Date.now();

  // Resume from whatever is already persisted rather than assuming a cold start.
  let steps: AgentStepLike[] = (
    await prisma.agentStep.findMany({ where: { ticketId }, orderBy: { stepNumber: 'asc' } })
  ).map((s) => ({
    stepNumber: s.stepNumber,
    thought: s.thought,
    action: s.action,
    actionInput: s.actionInput as Record<string, unknown>,
    observation: s.observation as unknown as ToolResult,
  }));

  const finish = async (
    decision: PlannerDecision,
    stepNumber: number,
    stepMs: number,
  ): Promise<RunSummary> => {
    const status = decision.action === 'respond' ? 'resolved' : 'escalated';
    const outcome = outcomeFor(decision);
    const runtimeMs = Date.now() - startedAt;

    await prisma.$transaction([
      prisma.agentStep.create({
        data: {
          ticketId,
          stepNumber,
          thought: decision.thought,
          action: decision.action,
          actionInput: decision.actionInput as Prisma.InputJsonValue,
          observation: terminalObservation(decision) as unknown as Prisma.InputJsonValue,
          durationMs: stepMs,
        },
      }),
      prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status,
          outcome,
          resolution: resolutionFor(decision),
          stepCount: stepNumber,
          runtimeMs,
        },
      }),
    ]);

    return { ticketId, status, outcome, steps: stepNumber, runtimeMs };
  };

  while (steps.length < maxSteps) {
    const stepStartedAt = Date.now();
    const decision = await planner.decide({
      ticket: {
        id: ticket.id,
        customerId: ticket.customerId,
        subject: ticket.subject,
        body: ticket.body,
      },
      steps,
      tools,
    });
    const stepNumber = steps.length + 1;

    if (isTerminal(decision.action)) {
      return finish(decision, stepNumber, Date.now() - stepStartedAt);
    }

    const tool = registry.get(decision.action);
    // An unregistered action is a planner bug, not a crash. It is recorded as a failed
    // observation and fed back, so the planner sees its own mistake on the next cycle and
    // the trace shows exactly what went wrong.
    const observation: ToolResult = tool
      ? await tool.run(decision.actionInput)
      : {
          ok: false,
          summary: `No tool named "${decision.action}" is registered.`,
          data: { available: tools.map((t) => t.name) },
        };
    const durationMs = Date.now() - stepStartedAt;

    await prisma.$transaction([
      prisma.agentStep.create({
        data: {
          ticketId,
          stepNumber,
          thought: decision.thought,
          action: decision.action,
          actionInput: decision.actionInput as Prisma.InputJsonValue,
          observation: observation as unknown as Prisma.InputJsonValue,
          durationMs,
        },
      }),
      prisma.ticket.update({ where: { id: ticketId }, data: { stepCount: stepNumber } }),
    ]);

    steps = [
      ...steps,
      {
        stepNumber,
        thought: decision.thought,
        action: decision.action,
        actionInput: decision.actionInput,
        observation,
      },
    ];
  }

  // Budget exhausted. An agent that can loop needs a hard stop that still leaves the
  // ticket in a defined state — a stuck "open" ticket nobody is working is the worst
  // possible outcome for a support queue.
  return finish(
    {
      thought: `I have used all ${maxSteps} of my allowed steps without reaching a resolution. Rather than keep spending, I am handing this to a human.`,
      action: 'escalate',
      actionInput: {
        reason: 'budget_exceeded',
        detail: `Step budget of ${maxSteps} exhausted before a terminal action.`,
      },
    },
    steps.length + 1,
    0,
  );
}
