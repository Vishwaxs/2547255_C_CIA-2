import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const app = createApp();
const api = request(app);

async function clearAll() {
  await prisma.exposure.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.flag.deleteMany();
  await redis.flushdb().catch(() => undefined);
}
beforeAll(clearAll);
afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

describe('TargetX end-to-end', () => {
  it('seeds the demo flags', async () => {
    const res = await api.post('/api/flags/seed');
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(3);
    const list = await api.get('/api/flags');
    expect(list.body).toHaveLength(3);
  });

  it('targets a matching context to the rule variation, else falls through', async () => {
    const us = await api.post('/api/flags/new-onboarding/evaluate').send({ unitKey: 'u-us', attributes: { country: 'US' } });
    expect(us.status).toBe(200);
    expect(us.body.variationKey).toBe('on');
    expect(us.body.reason).toBe('rule_match:0');
    expect(us.body.value).toBe(true);

    const gb = await api.post('/api/flags/new-onboarding/evaluate').send({ unitKey: 'u-gb', attributes: { country: 'GB' } });
    expect(gb.body.variationKey).toBe('off');
    expect(gb.body.reason).toBe('fallthrough');
  });

  it('serves the off variation once the flag is disabled', async () => {
    await api.patch('/api/flags/new-onboarding').send({ enabled: false });
    const res = await api.post('/api/flags/new-onboarding/evaluate').send({ unitKey: 'u-us', attributes: { country: 'US' } });
    expect(res.body.reason).toBe('flag_off');
    expect(res.body.variationKey).toBe('off');
    await api.patch('/api/flags/new-onboarding').send({ enabled: true }); // restore
  });

  it('assigns a rollout deterministically per unit and distributes roughly evenly', async () => {
    const counts: Record<string, number> = {};
    const first: Record<string, string> = {};
    const N = 300;
    for (let i = 0; i < N; i++) {
      const unit = `user-${i}`;
      const r = await api.post('/api/flags/pricing-page/evaluate').send({ unitKey: unit, attributes: {} });
      counts[r.body.variationKey] = (counts[r.body.variationKey] ?? 0) + 1;
      first[unit] = r.body.variationKey;
    }
    // Every variation gets a non-trivial share (34/33/33 split over 300 units).
    expect(Object.keys(counts).sort()).toEqual(['control', 'variant-b', 'variant-c']);
    for (const v of Object.values(counts)) expect(v).toBeGreaterThan(N * 0.15);

    // Sticky: re-evaluating a unit yields the same variation.
    const repeat = await api.post('/api/flags/pricing-page/evaluate').send({ unitKey: 'user-0', attributes: {} });
    expect(repeat.body.variationKey).toBe(first['user-0']);
  });

  it('logs an exposure per evaluation and aggregates them in stats', async () => {
    const stats = await api.get('/api/flags/pricing-page/stats');
    expect(stats.status).toBe(200);
    expect(stats.body.flag).toBe('pricing-page');
    // 300 rollout evals + 1 sticky repeat = 301 exposures.
    expect(stats.body.totalExposures).toBeGreaterThanOrEqual(300);
    const shareSum = stats.body.byVariation.reduce((a: number, v: { share: number }) => a + v.share, 0);
    expect(shareSum).toBeCloseTo(1, 5);
    expect(stats.body.byReason.some((r: { reason: string }) => r.reason === 'fallthrough')).toBe(true);
  });

  it('evaluates every flag for a context (SDK-style batch)', async () => {
    const res = await api.post('/api/evaluate').send({ unitKey: 'batch-user', attributes: { country: 'US', plan: 'pro' } });
    expect(res.status).toBe(200);
    expect(res.body.flags['new-onboarding'].variationKey).toBe('on');
    expect(res.body.flags['beta-dashboard'].variationKey).toBe('on'); // plan=pro rule
    expect(Object.keys(res.body.flags)).toHaveLength(3);
  });

  it('adds a rule via the API and applies it', async () => {
    const flag = await api.post('/api/flags').send({
      key: 'feature-z',
      name: 'Feature Z',
      variations: [{ key: 'on', value: true }, { key: 'off', value: false }],
      fallthrough: { variationKey: 'off' },
      offVariationKey: 'off',
    });
    expect(flag.status).toBe(201);
    const rule = await api.post('/api/flags/feature-z/rules').send({
      conditions: [{ attribute: 'beta', op: 'eq', values: [true] }],
      serve: { variationKey: 'on' },
    });
    expect(rule.status).toBe(201);
    const hit = await api.post('/api/flags/feature-z/evaluate').send({ unitKey: 'x', attributes: { beta: true } });
    expect(hit.body.variationKey).toBe('on');
    expect(hit.body.reason).toBe('rule_match:0');
  });

  it('rejects invalid input', async () => {
    const badFlag = await api.post('/api/flags').send({ key: 'x', name: 'x', variations: [{ key: 'on', value: 1 }], fallthrough: {}, offVariationKey: 'on' });
    expect(badFlag.status).toBe(400); // needs >= 2 variations
    const badEval = await api.post('/api/flags/pricing-page/evaluate').send({ attributes: {} });
    expect(badEval.status).toBe(400); // missing unitKey
    const dup = await api.post('/api/flags').send({
      key: 'pricing-page',
      name: 'dup',
      variations: [{ key: 'a', value: 1 }, { key: 'b', value: 2 }],
      fallthrough: { variationKey: 'a' },
      offVariationKey: 'a',
    });
    expect(dup.status).toBe(409); // duplicate key
  });
});
