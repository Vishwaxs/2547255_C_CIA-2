import { aggregateWindow, Point } from '../engine/window';

describe('aggregateWindow', () => {
  const now = 100000;
  const windowMs = 10000; // [90000, 100000]

  it('filters points outside the window', () => {
    const points: Point[] = [
      { ts: 85000, value: 999 }, // too old
      { ts: 92000, value: 10 },
      { ts: 96000, value: 20 },
      { ts: 100000, value: 30 },
    ];
    const a = aggregateWindow(points, now, windowMs);
    expect(a.count).toBe(3);
    expect(a.sum).toBe(60);
    expect(a.avg).toBe(20);
    expect(a.min).toBe(10);
    expect(a.max).toBe(30);
  });

  it('computes rate per second across the window', () => {
    const points: Point[] = Array.from({ length: 20 }, (_, i) => ({ ts: 90001 + i, value: 1 }));
    const a = aggregateWindow(points, now, windowMs);
    expect(a.ratePerSec).toBeCloseTo(20 / 10, 6); // 20 events over a 10s window
  });

  it('returns zeros for an empty window', () => {
    expect(aggregateWindow([], now, windowMs)).toMatchObject({ count: 0, sum: 0, avg: 0, min: 0, max: 0 });
  });
});
