import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const app = createApp();
const api = request(app);

async function clearAll() {
  await prisma.retrieval.deleteMany();
  await prisma.query.deleteMany();
  await prisma.chunk.deleteMany();
  await prisma.document.deleteMany();
  await redis.flushdb().catch(() => undefined);
}

beforeAll(async () => {
  await clearAll();
});

afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

const ANSWERABLE = 'What does a 404 status code mean?';
const OFF_TOPIC = 'How do I bake sourdough bread at home?';

describe('D1 RAG end-to-end (offline tfidf + extractive)', () => {
  it('seeds the demo corpus', async () => {
    const res = await api.post('/api/documents/seed');
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(4);

    const docs = await api.get('/api/documents');
    expect(docs.body).toHaveLength(4);
    expect(docs.body[0].chunkCount).toBeGreaterThan(0);
  });

  it('answers an in-corpus question with a grounded citation', async () => {
    const res = await api.post('/api/query').send({ question: ANSWERABLE });
    expect(res.status).toBe(200);
    expect(res.body.refused).toBe(false);
    expect(res.body.cacheHit).toBe(false);
    expect(res.body.citations.length).toBeGreaterThan(0);
    expect(res.body.topScore).toBeGreaterThanOrEqual(res.body.threshold);
    expect(res.body.latencyMs).toBeGreaterThanOrEqual(0);
    // every citation points at a chunk that was actually retrieved
    const retrievedIds = new Set(res.body.retrieved.map((r: { chunkId: string }) => r.chunkId));
    for (const c of res.body.citations) expect(retrievedIds.has(c.chunkId)).toBe(true);
    // it cites the HTTP document
    expect(res.body.citations.some((c: { documentTitle: string }) =>
      c.documentTitle.includes('HTTP'),
    )).toBe(true);
  });

  it('records a per-query retrieval audit, ranked, with cited flags', async () => {
    const list = await api.get('/api/queries');
    const id = list.body[0].id;
    const res = await api.get(`/api/queries/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.retrievals.length).toBeGreaterThan(0);
    res.body.retrievals.forEach((r: { rank: number }, i: number) => {
      expect(r.rank).toBe(i + 1); // contiguous 1-based ranks
    });
    expect(res.body.retrievals.some((r: { cited: boolean }) => r.cited)).toBe(true);
  });

  it('serves a repeated identical question from the cache', async () => {
    const res = await api.post('/api/query').send({ question: ANSWERABLE });
    expect(res.body.cacheHit).toBe(true);
    expect(res.body.refused).toBe(false);
  });

  it('busts the cache when the corpus changes', async () => {
    await api
      .post('/api/documents')
      .send({ title: 'Rate Limiting', text: 'A 429 status code means too many requests.' });
    const res = await api.post('/api/query').send({ question: ANSWERABLE });
    expect(res.body.cacheHit).toBe(false); // corpusVersion changed -> new cache key
  });

  it('refuses an off-topic question but still records the retrieval audit', async () => {
    const res = await api.post('/api/query').send({ question: OFF_TOPIC });
    expect(res.body.refused).toBe(true);
    expect(res.body.citations).toEqual([]);
    expect(res.body.retrieved.length).toBeGreaterThan(0); // considered-then-rejected
    // the Query row is still persisted
    const list = await api.get('/api/queries');
    expect(list.body.some((q: { question: string }) => q.question === OFF_TOPIC)).toBe(true);
  });

  it('reports analytics reflecting the answered/refused mix', async () => {
    const res = await api.get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalQueries).toBeGreaterThanOrEqual(3);
    expect(res.body.refused).toBeGreaterThanOrEqual(1);
    expect(res.body.answered).toBeGreaterThanOrEqual(1);
    expect(res.body.topCitedDocuments.length).toBeGreaterThan(0);
  });

  it('rejects an empty question with 400', async () => {
    const res = await api.post('/api/query').send({ question: '' });
    expect(res.status).toBe(400);
  });
});

describe('embedder mismatch guard', () => {
  beforeAll(async () => {
    await clearAll();
  });

  it('returns 409 when stored chunks were indexed with a different embedder', async () => {
    // Insert a document + a chunk tagged with a different embedder than the configured one.
    const doc = await prisma.document.create({
      data: { title: 'rogue', source: 'paste', contentHash: 'rogue-hash', charCount: 5, chunkCount: 1 },
    });
    await prisma.chunk.create({
      data: {
        documentId: doc.id,
        index: 0,
        text: 'hello world',
        charStart: 0,
        charEnd: 11,
        embedding: [0.1, 0.2],
        embedderKind: 'hashing', // configured kind in tests is tfidf
        dimension: 2,
        tokenCount: 2,
      },
    });
    const res = await api.post('/api/query').send({ question: 'hello?' });
    expect(res.status).toBe(409);
  });
});
