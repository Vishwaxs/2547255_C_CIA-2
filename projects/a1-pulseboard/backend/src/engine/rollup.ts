// Pure per-minute rollup: fold raw events into one aggregate row per minute. Used by the
// background job to build the durable time series that the History chart reads.

export interface RawEvent {
  ts: Date;
  value: number;
}

export interface RollupBucket {
  minute: Date; // start of the minute
  count: number;
  sum: number;
  min: number;
  max: number;
}

function floorToMinute(ts: Date): number {
  return Math.floor(ts.getTime() / 60000) * 60000;
}

export function rollup(events: RawEvent[]): RollupBucket[] {
  const byMinute = new Map<number, { count: number; sum: number; min: number; max: number }>();
  for (const e of events) {
    const key = floorToMinute(e.ts);
    const b = byMinute.get(key);
    if (!b) byMinute.set(key, { count: 1, sum: e.value, min: e.value, max: e.value });
    else {
      b.count++;
      b.sum += e.value;
      b.min = Math.min(b.min, e.value);
      b.max = Math.max(b.max, e.value);
    }
  }
  return [...byMinute.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([minute, b]) => ({ minute: new Date(minute), ...b }));
}
