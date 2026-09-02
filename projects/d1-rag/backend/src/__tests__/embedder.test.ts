import { TfidfEmbedder } from '../ai/tfidfEmbedder';
import { HashingEmbedder } from '../ai/hashingEmbedder';
import { OpenAIEmbedder } from '../ai/openaiEmbedder';
import { cosine, norm } from '../engine/vector';

const CORPUS = [
  'Redis is an in-memory cache serving reads in under a millisecond.',
  'Postgres uses a B-tree index to avoid a full table scan.',
  'Kafka is a distributed log for streaming events between services.',
];

describe('TfidfEmbedder', () => {
  it('is deterministic and L2-normalized', () => {
    const a = new TfidfEmbedder();
    a.fit(CORPUS);
    const b = new TfidfEmbedder();
    b.fit(CORPUS);
    const va = a.embed(CORPUS);
    const vb = b.embed(CORPUS);
    expect(va).toEqual(vb);
    for (const v of va) expect(norm(v)).toBeCloseTo(1, 10);
  });

  it('ranks a lexically-similar chunk above an unrelated one (retrieval is real)', () => {
    const e = new TfidfEmbedder();
    e.fit(CORPUS);
    const vecs = e.embed(CORPUS);
    const q = e.embed(['How does the B-tree index help Postgres?'])[0];
    const sims = vecs.map((v) => cosine(q, v));
    // chunk 1 (the Postgres/B-tree one) must score highest
    expect(sims.indexOf(Math.max(...sims))).toBe(1);
  });

  it('weights a rare, discriminative term over a corpus-wide one (IDF at work)', () => {
    // "service"/"services" appears broadly; "kafka" is unique to chunk 2.
    const e = new TfidfEmbedder();
    e.fit(CORPUS);
    const vecs = e.embed(CORPUS);
    const q = e.embed(['kafka streaming'])[0];
    const sims = vecs.map((v) => cosine(q, v));
    expect(sims.indexOf(Math.max(...sims))).toBe(2); // the Kafka chunk
  });

  it('returns a zero vector for text with no in-vocabulary terms', () => {
    const e = new TfidfEmbedder();
    e.fit(CORPUS);
    const [v] = e.embed(['zzz qqq']);
    expect(norm(v)).toBe(0);
  });
});

describe('HashingEmbedder', () => {
  it('has a fixed dimension, is deterministic and normalized', () => {
    const e = new HashingEmbedder(128);
    e.fit(CORPUS);
    expect(e.dimension).toBe(128);
    const a = e.embed(CORPUS);
    const b = e.embed(CORPUS);
    expect(a).toEqual(b);
    expect(a[0]).toHaveLength(128);
    for (const v of a) expect(norm(v)).toBeCloseTo(1, 10);
  });
});

describe('OpenAIEmbedder (stub)', () => {
  it('throws synchronously instead of attempting a network call', () => {
    const e = new OpenAIEmbedder();
    expect(() => e.embed(['anything'])).toThrow(/OPENAI_API_KEY|offline/i);
  });
});
