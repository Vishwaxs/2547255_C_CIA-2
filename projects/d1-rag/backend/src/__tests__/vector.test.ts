import { cosine, l2normalize, norm, topKByCosine } from '../engine/vector';

describe('cosine', () => {
  it('is 1 for identical, 0 for orthogonal, -1 for opposite', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  it('is zero-vector safe (no divide-by-zero / NaN)', () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
    expect(Number.isNaN(cosine([0, 0], [0, 0]))).toBe(false);
  });
});

describe('l2normalize', () => {
  it('produces a unit vector', () => {
    expect(norm(l2normalize([3, 4]))).toBeCloseTo(1, 10);
  });
  it('leaves the zero vector unchanged', () => {
    expect(l2normalize([0, 0])).toEqual([0, 0]);
  });
});

describe('topKByCosine', () => {
  const candidates = [
    { id: 'a', vector: [1, 0] },
    { id: 'b', vector: [0, 1] },
    { id: 'c', vector: [0.9, 0.1] },
  ];

  it('returns exactly k, sorted by descending score', () => {
    const top = topKByCosine([1, 0], candidates, 2);
    expect(top).toHaveLength(2);
    expect(top[0].id).toBe('a');
    expect(top[1].id).toBe('c');
    expect(top[0].score).toBeGreaterThanOrEqual(top[1].score);
  });

  it('breaks ties stably (input order preserved)', () => {
    const tied = [
      { id: 'x', vector: [1, 0] },
      { id: 'y', vector: [1, 0] },
    ];
    const top = topKByCosine([1, 0], tied, 2);
    expect(top.map((t) => t.id)).toEqual(['x', 'y']);
  });
});
