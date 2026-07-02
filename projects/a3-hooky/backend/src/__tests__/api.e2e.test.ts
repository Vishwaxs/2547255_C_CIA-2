import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { processDue } from '../services/dispatch.service';

const app = createApp();
const api = request(app);

async function clearAll() {
  await prisma.deliveryAttempt.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.event.deleteMany();
  await prisma.subscription.deleteMany();
  await redis.flushdb().catch(() => undefined);
}
beforeAll(clearAll);
afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

async function statusByMode(): Promise<Record<string, string>> {
  const ds = await prisma.delivery.findMany({ include: { subscription: { select: { mode: true } } } });
  return Object.fromEntries(ds.map((d) => [d.subscription.mode, `${d.status}:${d.attempts}`]));
}

describe('Hooky end-to-end', () => {
  it('seeds one subscription per delivery mode', async () => {
    const res = await api.post('/api/subscriptions/seed');
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(4);
  });

  it('publishes an event and fans out a delivery per subscription', async () => {
    const res = await api.post('/api/events').send({ type: 'order.created', payload: { id: 1 } });
    expect(res.status).toBe(202);
    expect(res.body.deliveries).toBe(4);
    expect(res.body.deduped).toBe(false);
  });

  it('delivers, retries with backoff, and dead-letters through the dispatch loop', async () => {
    const t0 = Date.now();
    for (const now of [t0, t0 + 2000, t0 + 6000, t0 + 14000, t0 + 30000]) {
      await processDue(now);
    }
    const s = await statusByMode();
    expect(s.ok).toBe('delivered:1'); // succeeds first try
    expect(s.flaky).toBe('delivered:3'); // fails twice, delivered on 3rd
    expect(s.fail).toBe('dead:5'); // dead-lettered at maxAttempts
    expect(s.slow).toBe('dead:5');
  });

  it('records a per-attempt delivery log', async () => {
    const list = await api.get('/api/deliveries');
    const flaky = list.body.find((d: { subscription: { mode: string } }) => d.subscription.mode === 'flaky');
    const detail = await api.get(`/api/deliveries/${flaky.id}`);
    expect(detail.body.attemptLog).toHaveLength(3);
    expect(detail.body.attemptLog.map((a: { ok: boolean }) => a.ok)).toEqual([false, false, true]);
  });

  it('replays a dead-lettered delivery with a fresh budget', async () => {
    const dead = (await api.get('/api/deliveries?status=dead')).body.find((d: { subscription: { mode: string } }) => d.subscription.mode === 'fail');
    const res = await api.post(`/api/deliveries/${dead.id}/replay`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(res.body.attempts).toBe(0);
  });

  it('dedupes a repeated idempotency key', async () => {
    const first = await api.post('/api/events').send({ type: 'x.y', payload: {}, idempotencyKey: 'k1' });
    const second = await api.post('/api/events').send({ type: 'x.y', payload: {}, idempotencyKey: 'k1' });
    expect(first.body.deduped).toBe(false);
    expect(second.body.deduped).toBe(true);
    expect(second.body.eventId).toBe(first.body.eventId);
    expect(second.body.deliveries).toBe(0);
  });

  it('reports delivery stats', async () => {
    const res = await api.get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.subscriptions).toBe(4);
    expect(res.body.totalDeliveries).toBeGreaterThan(0);
    expect(res.body.byStatus.length).toBe(5);
  });

  it('validates input', async () => {
    await api.post('/api/events').send({ payload: {} }).expect(400); // no type
    await api.post('/api/subscriptions').send({ name: 'x' }).expect(400); // no endpoint
  });
});
