import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const app = createApp();
const api = request(app);

async function clearAll() {
  await prisma.insight.deleteMany();
  await prisma.deck.deleteMany();
  await prisma.column.deleteMany();
  await prisma.dataset.deleteMany();
  await redis.flushdb().catch(() => undefined);
}

beforeAll(async () => {
  await clearAll();
});
afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

describe('InsightDeck end-to-end (offline template narrator)', () => {
  let datasetId = '';

  it('seeds the demo dataset and infers column types', async () => {
    const res = await api.post('/api/datasets/seed');
    expect(res.status).toBe(201);
    datasetId = res.body.dataset.id;

    const detail = await api.get(`/api/datasets/${datasetId}`);
    const types = Object.fromEntries(detail.body.columns.map((c: { name: string; inferredType: string }) => [c.name, c.inferredType]));
    expect(types.date).toBe('datetime');
    expect(types.region).toBe('categorical');
    expect(types.revenue).toBe('numeric');
  });

  it('generates a deck of ranked, narrated insights with charts', async () => {
    const res = await api.post(`/api/datasets/${datasetId}/generate`);
    expect(res.status).toBe(201);
    expect(res.body.cacheHit).toBe(false);
    expect(res.body.insights.length).toBeGreaterThan(3);

    const types = new Set(res.body.insights.map((i: { type: string }) => i.type));
    expect(types.has('trend')).toBe(true);
    expect(types.has('correlation')).toBe(true);
    expect(types.has('outliers')).toBe(true);

    res.body.insights.forEach((ins: { rank: number; title: string; chartSpec: { data: unknown[] } }, i: number) => {
      expect(ins.rank).toBe(i + 1); // ranked, contiguous
      expect(ins.title.length).toBeGreaterThan(0); // narrated
      expect(Array.isArray(ins.chartSpec.data)).toBe(true); // chart-ready
    });
    // sorted by descending score
    const scores = res.body.insights.map((i: { score: number }) => i.score);
    expect(scores).toEqual([...scores].sort((a: number, b: number) => b - a));
  });

  it('serves a regenerated deck from cache', async () => {
    const res = await api.post(`/api/datasets/${datasetId}/generate`);
    expect(res.body.cacheHit).toBe(true);
  });

  it('infers types correctly for a custom CSV with quoted fields', async () => {
    const csv = 'name,city,active,score\n"Doe, John",London,true,9.5\nAda,Paris,false,7\nGrace,Rome,true,8';
    const res = await api.post('/api/datasets').send({ name: 'people', csv });
    expect(res.status).toBe(201);
    const detail = await api.get(`/api/datasets/${res.body.dataset.id}`);
    const types = Object.fromEntries(detail.body.columns.map((c: { name: string; inferredType: string }) => [c.name, c.inferredType]));
    expect(types.active).toBe('boolean');
    expect(types.score).toBe('numeric');
    expect(detail.body.sampleRows[0].name).toBe('Doe, John'); // quoted comma preserved
  });

  it('dedupes identical uploads', async () => {
    const csv = 'x,y\n1,2\n3,4';
    const first = await api.post('/api/datasets').send({ name: 'dup', csv });
    const second = await api.post('/api/datasets').send({ name: 'dup', csv });
    expect(first.body.created).toBe(true);
    expect(second.body.created).toBe(false);
  });

  it('reports analytics across datasets and decks', async () => {
    const res = await api.get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.datasetCount).toBeGreaterThanOrEqual(3);
    expect(res.body.deckCount).toBeGreaterThanOrEqual(1);
    expect(res.body.insightsByType.length).toBeGreaterThan(0);
  });

  it('rejects an empty name and a header-only CSV', async () => {
    expect((await api.post('/api/datasets').send({ name: '', csv: 'a\n1' })).status).toBe(400);
    expect((await api.post('/api/datasets').send({ name: 'x', csv: 'only_header' })).status).toBe(400);
  });

  it('deletes a dataset and cascades', async () => {
    const del = await api.delete(`/api/datasets/${datasetId}`);
    expect(del.status).toBe(204);
    expect((await api.get(`/api/datasets/${datasetId}`)).status).toBe(404);
  });
});
