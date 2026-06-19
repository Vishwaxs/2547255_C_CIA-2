import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { flushClicks } from '../services/clickBuffer';

// Integration test against a REAL Postgres + Redis (provided by docker-compose
// locally or service containers in CI). Exercises the full request paths:
// create -> redirect (cache-aside MISS/HIT) -> buffered flush -> analytics, plus
// validation and rate-limit edges.
const app = createApp();
const unique = Date.now();

afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

describe('Snipr API (integration)', () => {
  let code = '';

  it('creates a short link with a random base62 code', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ targetUrl: `https://example.com/e2e/${unique}` })
      .expect(201);
    expect(res.body.code).toMatch(/^[0-9A-Za-z]{7}$/);
    expect(res.body.shortUrl).toContain(res.body.code);
    code = res.body.code;
  });

  it('rejects an invalid URL with 400', async () => {
    await request(app).post('/api/links').send({ targetUrl: 'not-a-url' }).expect(400);
  });

  it('honours custom aliases and rejects duplicates with 409', async () => {
    const alias = `e2e-${unique}`;
    await request(app).post('/api/links').send({ targetUrl: 'https://anthropic.com', customAlias: alias }).expect(201);
    await request(app).post('/api/links').send({ targetUrl: 'https://anthropic.com', customAlias: alias }).expect(409);
  });

  it('serves the cache-aside path: MISS (cold) then HIT (warm)', async () => {
    // Evict so the first redirect is a genuine miss that repopulates the cache.
    await redis.del(`link:${code}`);
    const miss = await request(app).get(`/${code}`).expect(302);
    expect(miss.headers['x-cache']).toBe('MISS');
    expect(miss.headers.location).toBe(`https://example.com/e2e/${unique}`);

    const hit = await request(app).get(`/${code}`).expect(302);
    expect(hit.headers['x-cache']).toBe('HIT');
  });

  it('returns 404 for an unknown code', async () => {
    await request(app).get('/no-such-code').expect(404);
  });

  it('persists buffered clicks and rolls them up into analytics', async () => {
    // The two redirects above were buffered; drain and persist them.
    const persisted = await flushClicks();
    expect(persisted).toBeGreaterThanOrEqual(2);

    const stats = await request(app).get(`/api/links/${code}/stats`).expect(200);
    expect(stats.body.totalClicks).toBeGreaterThanOrEqual(2);
    expect(stats.body.byDay.length).toBeGreaterThanOrEqual(1);
  });
});
