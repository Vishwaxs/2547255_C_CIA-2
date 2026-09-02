import { rollup } from '../engine/rollup';

describe('rollup', () => {
  it('groups events into per-minute buckets', () => {
    const buckets = rollup([
      { ts: new Date('2026-01-01T00:00:05Z'), value: 10 },
      { ts: new Date('2026-01-01T00:00:35Z'), value: 30 },
      { ts: new Date('2026-01-01T00:01:10Z'), value: 100 },
    ]);
    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({ count: 2, sum: 40, min: 10, max: 30 });
    expect(buckets[1]).toMatchObject({ count: 1, sum: 100 });
    // sorted ascending by minute
    expect(buckets[0].minute.getTime()).toBeLessThan(buckets[1].minute.getTime());
  });

  it('returns nothing for no events', () => {
    expect(rollup([])).toEqual([]);
  });
});
