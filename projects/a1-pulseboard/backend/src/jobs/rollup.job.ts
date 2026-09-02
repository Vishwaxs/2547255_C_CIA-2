import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { rollup, RawEvent } from '../engine/rollup';

// Roll the recent raw events into per-minute Bucket rows (idempotent upsert keyed by
// metric + minute), building the durable time series the History chart reads.
export async function runRollup(now: number = Date.now()): Promise<number> {
  const since = new Date(now - 2 * 60000);
  const events = await prisma.event.findMany({
    where: { ts: { gte: since } },
    select: { metricId: true, ts: true, value: true },
  });

  const byMetric = new Map<string, RawEvent[]>();
  for (const e of events) {
    const list = byMetric.get(e.metricId) ?? [];
    list.push({ ts: e.ts, value: e.value });
    byMetric.set(e.metricId, list);
  }

  let written = 0;
  for (const [metricId, evs] of byMetric) {
    for (const b of rollup(evs)) {
      await prisma.bucket.upsert({
        where: { metricId_minute: { metricId, minute: b.minute } },
        create: { metricId, minute: b.minute, count: b.count, sum: b.sum, min: b.min, max: b.max },
        update: { count: b.count, sum: b.sum, min: b.min, max: b.max },
      });
      written++;
    }
  }
  return written;
}

export function startRollupJob(): NodeJS.Timeout {
  return setInterval(() => void runRollup(), env.ROLLUP_MS);
}
