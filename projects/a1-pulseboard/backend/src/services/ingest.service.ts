import { Prisma, Metric } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { env } from '../config/env';

export const winKey = (metricId: string): string => `pulse:win:${metricId}`;

// Find a metric by name, creating it with defaults if it's new (ingest is forgiving —
// you can start pushing a metric before formally defining its unit/threshold).
export async function ensureMetric(name: string): Promise<Metric> {
  const existing = await prisma.metric.findUnique({ where: { name } });
  if (existing) return existing;
  return prisma.metric.create({ data: { name } });
}

// Ingest one data point: persist the Event (durable) and push it into the metric's Redis
// sliding-window sorted set (live), trimming anything older than the window. The Redis
// writes are fail-open — a Redis outage never loses the event, and the aggregate service
// rebuilds the window from Postgres.
export async function ingestEvent(input: {
  metric: string;
  value: number;
  tags?: Record<string, unknown>;
  ts?: number;
}): Promise<{ eventId: string; metricId: string }> {
  const metric = await ensureMetric(input.metric);
  const ts = input.ts ? new Date(input.ts) : new Date();
  const event = await prisma.event.create({
    data: {
      metricId: metric.id,
      value: input.value,
      tags: (input.tags ?? {}) as Prisma.InputJsonValue,
      ts,
    },
  });

  const tsMs = ts.getTime();
  const key = winKey(metric.id);
  await redis.zadd(key, tsMs, `${input.value}#${event.id}`).catch(() => undefined);
  await redis.zremrangebyscore(key, 0, tsMs - env.WINDOW_MS).catch(() => undefined);
  await redis.expire(key, Math.ceil(env.WINDOW_MS / 1000) + 60).catch(() => undefined);

  return { eventId: event.id, metricId: metric.id };
}
