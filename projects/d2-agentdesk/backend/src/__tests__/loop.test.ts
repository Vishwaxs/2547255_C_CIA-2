import { prisma } from '../lib/prisma';
import { runAgentLoop } from '../engine/loop';
import { Planner, PlannerDecision } from '../engine/types';
import { seedDemo } from '../services/agent.service';
import { redis } from '../lib/redis';

// These exercise the loop against a real database, because the parts worth testing here
// are exactly the parts that are not pure: persistence of every step, the terminal status
// transition, and the guards.
async function reset() {
  await prisma.agentStep.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
  await prisma.order.deleteMany();
  try {
    await redis.flushall();
  } catch {
    /* cache is optional */
  }
}

beforeAll(reset);
afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

describe('runAgentLoop — the four seeded scenarios', () => {
  beforeAll(async () => {
    await reset();
    await seedDemo();
  });

  const findTicket = (customerId: string) =>
    prisma.ticket.findFirstOrThrow({
      where: { customerId },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

  it('answers a covered question from the knowledge base', async () => {
    const t = await findTicket('cust-101');
    expect(t.status).toBe('resolved');
    expect(t.outcome).toBe('answered_from_kb');
    expect(t.steps.map((s) => s.action)).toEqual(['search_kb', 'respond']);
  });

  it('refunds a real order and records the money movement', async () => {
    const t = await findTicket('cust-202');
    expect(t.status).toBe('resolved');
    expect(t.outcome).toBe('refund_issued');
    expect(t.steps.map((s) => s.action)).toEqual(['lookup_order', 'issue_refund', 'respond']);

    const keyboard = await prisma.order.findFirstOrThrow({ where: { product: 'Mechanical keyboard' } });
    expect(keyboard.status).toBe('refunded');
    expect(keyboard.refundedAt).not.toBeNull();
  });

  it('refuses to refund a customer with no orders', async () => {
    const t = await findTicket('cust-303');
    expect(t.status).toBe('escalated');
    expect(t.outcome).toBe('no_order_found');
    expect(t.steps.map((s) => s.action)).toEqual(['lookup_order', 'escalate']);
  });

  it('refuses to answer a question the knowledge base does not cover', async () => {
    const t = await findTicket('cust-404');
    expect(t.status).toBe('escalated');
    expect(t.outcome).toBe('no_kb_coverage');
    expect(t.steps.map((s) => s.action)).toEqual(['search_kb', 'escalate']);
    // The weak candidate must be recorded, not silently discarded.
    const search = t.steps[0].observation as { data: { rejected: unknown[] } };
    expect(search.data.rejected.length).toBeGreaterThan(0);
  });

  it('escalates when the only order is already refunded', async () => {
    const t = await findTicket('cust-505');
    expect(t.status).toBe('escalated');
    expect(t.outcome).toBe('refund_failed');
  });

  it('persists a complete observation for every step', async () => {
    const steps = await prisma.agentStep.findMany();
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) {
      expect(s.thought.length).toBeGreaterThan(0);
      expect(s.observation).toHaveProperty('ok');
      expect(s.observation).toHaveProperty('summary');
    }
  });
});

describe('runAgentLoop — guards', () => {
  it('rejects a second run of a finished ticket with 409', async () => {
    const t = await prisma.ticket.findFirstOrThrow({ where: { customerId: 'cust-101' } });
    await expect(runAgentLoop(t.id)).rejects.toMatchObject({ status: 409 });
  });

  it('404s on a ticket that does not exist', async () => {
    await expect(runAgentLoop('does-not-exist')).rejects.toMatchObject({ status: 404 });
  });

  it('force-escalates when a planner never terminates', async () => {
    const ticket = await prisma.ticket.create({
      data: { customerId: 'cust-loop', subject: 'spin', body: 'spin' },
    });
    // A planner that only ever calls tools. Without a budget this would never stop.
    const runaway: Planner = {
      kind: 'runaway',
      decide: (): PlannerDecision => ({
        thought: 'again',
        action: 'lookup_order',
        actionInput: { customerId: 'cust-loop' },
      }),
    };

    const summary = await runAgentLoop(ticket.id, { planner: runaway, maxSteps: 2 });
    expect(summary.status).toBe('escalated');
    expect(summary.outcome).toBe('budget_exceeded');
    // 2 tool steps plus the forced escalation.
    expect(summary.steps).toBe(3);

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.status).toBe('escalated');
    expect(after.stepCount).toBe(3);
  });

  it('records an unknown tool as a failed observation instead of crashing', async () => {
    const ticket = await prisma.ticket.create({
      data: { customerId: 'cust-bad', subject: 'bad', body: 'bad' },
    });
    let called = 0;
    const bogus: Planner = {
      kind: 'bogus',
      decide: (): PlannerDecision =>
        ++called === 1
          ? { thought: 'try', action: 'no_such_tool', actionInput: {} }
          : { thought: 'give up', action: 'escalate', actionInput: { reason: 'refund_failed' } },
    };

    await runAgentLoop(ticket.id, { planner: bogus, maxSteps: 5 });
    const steps = await prisma.agentStep.findMany({
      where: { ticketId: ticket.id },
      orderBy: { stepNumber: 'asc' },
    });
    const obs = steps[0].observation as { ok: boolean; summary: string };
    expect(obs.ok).toBe(false);
    expect(obs.summary).toContain('no_such_tool');
  });
});

describe('issue_refund idempotency', () => {
  it('refuses to refund the same order twice', async () => {
    const { issueRefundTool } = await import('../engine/tools/issueRefund.tool');
    const order = await prisma.order.create({
      data: { customerId: 'cust-idem', product: 'Widget', amount: 10 },
    });

    const first = await issueRefundTool.run({ orderId: order.id });
    expect(first.ok).toBe(true);

    const second = await issueRefundTool.run({ orderId: order.id });
    expect(second.ok).toBe(false);
    expect(second.summary).toContain('already refunded');
  });

  it('reports a missing order honestly', async () => {
    const { issueRefundTool } = await import('../engine/tools/issueRefund.tool');
    const res = await issueRefundTool.run({ orderId: 'nope' });
    expect(res.ok).toBe(false);
    expect(res.summary).toContain('does not exist');
  });
});
