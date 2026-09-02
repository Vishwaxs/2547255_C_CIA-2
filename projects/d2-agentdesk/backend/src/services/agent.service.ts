import { prisma } from '../lib/prisma';
import { runAgentLoop } from '../engine/loop';
import { buildRegistry } from '../engine/toolRegistry';
import { getTicketWithSteps } from './ticket.service';
import { cacheDrop } from '../lib/redis';
import { KB_CACHE_KEY } from '../engine/tools/searchKb.tool';
import { SEED_ARTICLES, SEED_ORDERS, SEED_TICKETS } from './seed.data';
import { env } from '../config/env';

/** Run the loop, then hand back the ticket with its freshly written trace so the caller
 *  gets the whole story in one round trip. */
export async function runTicket(id: string) {
  const summary = await runAgentLoop(id);
  const ticket = await getTicketWithSteps(id);
  return { summary, ticket };
}

export interface SeedResult {
  articles: number;
  orders: number;
  tickets: number;
  skippedTickets: number;
  ran: number;
}

/**
 * Idempotent demo seed. Articles and orders are only planted when their tables are empty
 * (neither has a natural unique key at this scale, and re-seeding a half-refunded world
 * would quietly break the scenarios). Tickets are deduped per row so re-running adds only
 * what is genuinely missing.
 *
 * Seeded tickets are run immediately: this is the one place auto-run is right, because a
 * reviewer hitting seed wants the finished traces to look at, not five empty queues.
 */
export async function seedDemo(): Promise<SeedResult> {
  let articles = 0;
  if ((await prisma.knowledgeArticle.count()) === 0) {
    await prisma.knowledgeArticle.createMany({ data: SEED_ARTICLES });
    articles = SEED_ARTICLES.length;
    await cacheDrop(KB_CACHE_KEY);
  }

  let orders = 0;
  if ((await prisma.order.count()) === 0) {
    await prisma.order.createMany({
      data: SEED_ORDERS.map((o) => ({
        ...o,
        refundedAt: o.status === 'refunded' ? new Date() : null,
      })),
    });
    orders = SEED_ORDERS.length;
  }

  let tickets = 0;
  let skippedTickets = 0;
  let ran = 0;

  for (const t of SEED_TICKETS) {
    const exists = await prisma.ticket.findFirst({
      where: { customerId: t.customerId, subject: t.subject },
    });
    if (exists) {
      skippedTickets++;
      continue;
    }
    const created = await prisma.ticket.create({
      data: { customerId: t.customerId, subject: t.subject, body: t.body },
    });
    tickets++;
    // One bad scenario must not abort the rest of the seed.
    try {
      await runAgentLoop(created.id);
      ran++;
    } catch (err) {
      console.error(`[seed] agent run failed for "${t.subject}":`, (err as Error).message);
    }
  }

  return { articles, orders, tickets, skippedTickets, ran };
}

/** What the agent is capable of, and how it is currently wired. Surfaced to the UI so the
 *  tool registry and planner choice are visible rather than buried in config. */
export function describeAgent() {
  return {
    planner: env.PLANNER_KIND,
    maxSteps: env.AGENT_MAX_STEPS,
    tools: buildRegistry().list(),
    terminalActions: ['respond', 'escalate'],
  };
}

/** Aggregate rollup for the analytics view. Deliberately a handful of grouped counts
 *  rather than a stats table — there is nothing here worth denormalizing yet. */
export async function agentStats() {
  const [byStatus, byOutcome, byAction, totals] = await Promise.all([
    prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ['outcome'], _count: { _all: true } }),
    prisma.agentStep.groupBy({ by: ['action'], _count: { _all: true } }),
    prisma.ticket.aggregate({ _count: { _all: true }, _avg: { stepCount: true, runtimeMs: true } }),
  ]);

  const resolved = byStatus.find((s) => s.status === 'resolved')?._count._all ?? 0;
  const escalated = byStatus.find((s) => s.status === 'escalated')?._count._all ?? 0;
  const handled = resolved + escalated;

  return {
    tickets: totals._count._all,
    resolved,
    escalated,
    open: byStatus.find((s) => s.status === 'open')?._count._all ?? 0,
    // Share of *finished* runs the agent closed without a human. Measuring against handled
    // rather than all tickets keeps a queue of untouched tickets from deflating the number.
    autonomyRate: handled ? Math.round((resolved / handled) * 100) : 0,
    avgSteps: Number((totals._avg.stepCount ?? 0).toFixed(2)),
    avgRuntimeMs: Math.round(totals._avg.runtimeMs ?? 0),
    byOutcome: byOutcome
      .filter((o) => o.outcome)
      .map((o) => ({ outcome: o.outcome as string, count: o._count._all }))
      .sort((a, b) => b.count - a.count),
    byAction: byAction
      .map((a) => ({ action: a.action, count: a._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}
