import request from 'supertest';
import http from 'http';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { tickOnce } from '../stream/broadcaster';
import { runRollup } from '../jobs/rollup.job';

const app = createApp();
const api = request(app);

async function clearAll() {
  await prisma.alert.deleteMany();
  await prisma.bucket.deleteMany();
  await prisma.event.deleteMany();
  await prisma.metric.deleteMany();
  await redis.flushdb().catch(() => undefined);
}
beforeAll(clearAll);
afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

describe('PulseBoard end-to-end', () => {
  it('seeds default metrics', async () => {
    const res = await api.post('/api/metrics/seed');
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(4);
  });

  it('ingests events and reflects them in the live snapshot', async () => {
    await api
      .post('/api/events')
      .send([
        { metric: 'latency_ms', value: 100 },
        { metric: 'latency_ms', value: 300 },
        { metric: 'latency_ms', value: 200 },
      ])
      .expect(202);

    const snap = await api.get('/api/metrics');
    const latency = snap.body.find((m: { name: string }) => m.name === 'latency_ms');
    expect(latency.aggregate.count).toBe(3);
    expect(latency.aggregate.avg).toBeCloseTo(200, 5);
    expect(latency.aggregate.max).toBe(300);
  });

  it('fires an edge-triggered alert on a threshold breach', async () => {
    await api.post('/api/events').send({ metric: 'cpu', value: 98 }).expect(202); // > 90 max_value
    await tickOnce(); // simulate a broadcaster tick (reconciles alerts)
    const alerts = await api.get('/api/alerts');
    const cpuAlert = alerts.body.find((a: { message: string }) => a.message.includes('cpu'));
    expect(cpuAlert).toBeTruthy();
    expect(cpuAlert.resolvedAt).toBeNull();

    // a second tick must NOT create a duplicate (edge-triggered)
    await tickOnce();
    const again = await api.get('/api/alerts');
    expect(again.body.filter((a: { message: string; resolvedAt: string | null }) => a.message.includes('cpu') && !a.resolvedAt)).toHaveLength(1);
  });

  it('rolls events into per-minute buckets exposed via the series endpoint', async () => {
    const written = await runRollup();
    expect(written).toBeGreaterThan(0);
    const series = await api.get('/api/metrics/latency_ms/series');
    expect(series.status).toBe(200);
    expect(series.body.buckets.length).toBeGreaterThan(0);
    expect(series.body.buckets[0]).toHaveProperty('avg');
  });

  it('streams live frames over SSE', async () => {
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;

    const chunk = await new Promise<string>((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}/api/stream`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(String(res.headers['content-type'])).toContain('text/event-stream');
        let buf = '';
        res.on('data', (d: Buffer) => {
          buf += d.toString();
          if (buf.includes('event:')) {
            req.destroy();
            resolve(buf);
          }
        });
      });
      req.on('error', () => undefined); // destroy() triggers an error we can ignore
      setTimeout(() => {
        req.destroy();
        reject(new Error('SSE timeout'));
      }, 4000);
    });
    expect(chunk).toContain('event:');
    server.close();
  });

  it('rejects an invalid event with 400', async () => {
    await api.post('/api/events').send({ metric: 'cpu' }).expect(400); // missing value
  });
});
