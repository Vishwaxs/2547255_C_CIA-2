// Pure sliding-window aggregation. Given timestamped points, a "now", and a window size,
// it filters to the points inside [now - windowMs, now] and computes the live aggregates
// a dashboard tile shows. No I/O — the Redis/Postgres plumbing lives in the services.

export interface Point {
  ts: number; // epoch ms
  value: number;
}

export interface Aggregate {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  ratePerSec: number; // events per second across the window
}

export function aggregateWindow(points: Point[], now: number, windowMs: number): Aggregate {
  const cutoff = now - windowMs;
  const values: number[] = [];
  for (const p of points) if (p.ts >= cutoff && p.ts <= now) values.push(p.value);

  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count,
    sum,
    avg: count ? sum / count : 0,
    min: count ? Math.min(...values) : 0,
    max: count ? Math.max(...values) : 0,
    ratePerSec: count / (windowMs / 1000),
  };
}
