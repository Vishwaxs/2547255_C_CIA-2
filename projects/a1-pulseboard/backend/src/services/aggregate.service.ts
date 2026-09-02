import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { env } from '../config/env';
import { aggregateWindow, Point, Aggregate } from '../engine/window';
import { evaluateThreshold, Breach } from '../engine/threshold';
import { winKey } from './ingest.service';

// Read a metric's current window points from Redis (the live path). If Redis errors or
// has nothing, rebuild the window from Postgres — the fail-open resilience path.
export async function windowPoints(metricId: string, now: number): Promise<Point[]> {
  try {
    const raw = await redis.zrangebyscore(winKey(metricId), now - env.WINDOW_MS, now, 'WITHSCORES');
    if (raw.length > 0) {
      const points: Point[] = [];
      for (let i = 0; i < raw.length; i += 2) {
        points.push({ value: Number(raw[i].split('#')[0]), ts: Number(raw[i + 1]) });
      }
      return points;
    }
  } catch {
    // fall through to Postgres
  }
  const rows = await prisma.event.findMany({
    where: { metricId, ts: { gte: new Date(now - env.WINDOW_MS) } },
    select: { ts: true, value: true },
  });
  return rows.map((r) => ({ ts: r.ts.getTime(), value: r.value }));
}

export interface MetricSnapshot {
  id: string;
  name: string;
  unit: string;
  thresholdType: string;
  thresholdValue: number | null;
  aggregate: Aggregate;
  status: 'ok' | 'warning' | 'critical';
  breach: Breach | null;
}

// Build a live snapshot of every metric: window aggregate + threshold status. This is
// what the SSE broadcaster pushes and what GET /api/metrics returns.
export async function snapshot(now: number = Date.now()): Promise<MetricSnapshot[]> {
  const metrics = await prisma.metric.findMany({ orderBy: { name: 'asc' } });
  const out: MetricSnapshot[] = [];
  for (const m of metrics) {
    const agg = aggregateWindow(await windowPoints(m.id, now), now, env.WINDOW_MS);
    const breach = evaluateThreshold(m, agg);
    out.push({
      id: m.id,
      name: m.name,
      unit: m.unit,
      thresholdType: m.thresholdType,
      thresholdValue: m.thresholdValue,
      aggregate: agg,
      status: breach ? breach.level : 'ok',
      breach,
    });
  }
  return out;
}
