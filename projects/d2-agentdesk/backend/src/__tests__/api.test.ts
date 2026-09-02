import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const app = createApp();

beforeAll(async () => {
  await prisma.agentStep.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
  await prisma.order.deleteMany();
  try {
    await redis?.flushall();
  } catch {
    /* cache is optional */
  }
});

afterAll(async () => {
  await prisma.$disconnect();
  redis?.disconnect();
});

describe('HTTP surface', () => {
  it('reports health for both dependencies', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.postgres).toBe(true);
    // redis is true when configured and reachable, 'not_configured' when absent (serverless)
    expect([true, 'not_configured']).toContain(res.body.redis);
  });

  it('describes the agent and its registered tools', async () => {
    const res = await request(app).get('/api/world/agent');
    expect(res.status).toBe(200);
    expect(res.body.planner).toBe('rule_based');
    expect(res.body.tools.map((t: { name: string }) => t.name)).toEqual([
      'search_kb',
      'lookup_order',
      'issue_refund',
    ]);
  });

  it('seeds the demo world and runs every seeded ticket', async () => {
    const res = await request(app).post('/api/seed');
    expect(res.status).toBe(201);
    expect(res.body.tickets).toBe(5);
    expect(res.body.ran).toBe(5);
  });

  it('is idempotent on a second seed', async () => {
    const res = await request(app).post('/api/seed');
    expect(res.body.tickets).toBe(0);
    expect(res.body.skippedTickets).toBe(5);
  });

  it('lists tickets and filters by status', async () => {
    const all = await request(app).get('/api/tickets');
    expect(all.body).toHaveLength(5);

    const escalated = await request(app).get('/api/tickets?status=escalated');
    expect(escalated.body.length).toBe(3);
    expect(escalated.body.every((t: { status: string }) => t.status === 'escalated')).toBe(true);
  });

  it('ignores an unknown status filter rather than returning nothing', async () => {
    const res = await request(app).get('/api/tickets?status=bogus');
    expect(res.body).toHaveLength(5);
  });

  it('returns a ticket with its ordered trace', async () => {
    const list = await request(app).get('/api/tickets');
    const id = list.body[0].id;
    const res = await request(app).get(`/api/tickets/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.steps.length).toBeGreaterThan(0);
    expect(res.body.steps.map((s: { stepNumber: number }) => s.stepNumber)).toEqual(
      res.body.steps.map((_: unknown, i: number) => i + 1),
    );
  });

  it('validates the create body', async () => {
    const res = await request(app).post('/api/tickets').send({ subject: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('customerId');
  });

  it('creates a ticket open with no steps, then runs it on demand', async () => {
    const created = await request(app)
      .post('/api/tickets')
      .send({ customerId: 'cust-999', subject: 'Where is my parcel?', body: 'I need tracking for my delivery' });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('open');
    expect(created.body.stepCount).toBe(0);

    const run = await request(app).post(`/api/tickets/${created.body.id}/run`);
    expect(run.status).toBe(200);
    expect(run.body.summary.status).toBe('resolved');
    expect(run.body.ticket.steps.map((s: { action: string }) => s.action)).toEqual([
      'search_kb',
      'respond',
    ]);
  });

  it('409s when running a ticket that has already finished', async () => {
    const list = await request(app).get('/api/tickets?status=resolved');
    const res = await request(app).post(`/api/tickets/${list.body[0].id}/run`);
    expect(res.status).toBe(409);
  });

  it('404s for an unknown ticket and an unknown route', async () => {
    expect((await request(app).get('/api/tickets/nope')).status).toBe(404);
    expect((await request(app).get('/api/nothing')).status).toBe(404);
  });

  it('exposes the world the agent acted on', async () => {
    const kb = await request(app).get('/api/world/kb');
    expect(kb.body).toHaveLength(5);

    const orders = await request(app).get('/api/world/orders?customerId=cust-202');
    expect(orders.body).toHaveLength(2);
    expect(orders.body.some((o: { status: string }) => o.status === 'refunded')).toBe(true);
  });

  it('rolls up run statistics', async () => {
    const res = await request(app).get('/api/world/stats');
    expect(res.status).toBe(200);
    expect(res.body.tickets).toBeGreaterThan(0);
    expect(res.body.autonomyRate).toBeGreaterThanOrEqual(0);
    expect(res.body.byOutcome.length).toBeGreaterThan(0);
  });

  it('deletes a ticket and cascades its trace', async () => {
    const created = await request(app)
      .post('/api/tickets')
      .send({ customerId: 'cust-del', subject: 'temp', body: 'temp' });
    await request(app).post(`/api/tickets/${created.body.id}/run`);

    expect((await request(app).delete(`/api/tickets/${created.body.id}`)).status).toBe(204);
    expect(await prisma.agentStep.count({ where: { ticketId: created.body.id } })).toBe(0);
    expect((await request(app).delete(`/api/tickets/${created.body.id}`)).status).toBe(404);
  });
});
