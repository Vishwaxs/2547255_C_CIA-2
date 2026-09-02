import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';

const BUFFER_KEY = 'buf:clicks';

export interface ClickEvent {
  code: string;
  ts: string; // ISO timestamp
  referrer?: string;
  country?: string;
  uaHash?: string;
}

// Fire-and-forget write: push the click event onto a Redis list. This keeps the
// redirect hot path completely free of any Postgres round-trip — the redirect
// returns immediately and analytics persistence happens out of band.
export async function bufferClick(evt: ClickEvent): Promise<void> {
  await redis.rpush(BUFFER_KEY, JSON.stringify(evt));
}

// Drain up to `max` buffered events and persist them in one batch. LPOP with a
// count (Redis >= 6.2) pulls them off atomically; we resolve codes -> link ids
// once, then write all Click rows and bump the denormalized clickCount inside a
// single transaction. Batching turns N redirects into ~1 write round-trip.
export async function flushClicks(max = 1000): Promise<number> {
  const raw = await redis.lpop(BUFFER_KEY, max);
  if (!raw || raw.length === 0) return 0;

  const events: ClickEvent[] = raw.map((r) => JSON.parse(r) as ClickEvent);

  const codes = [...new Set(events.map((e) => e.code))];
  const links = await prisma.link.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const idByCode = new Map(links.map((l) => [l.code, l.id]));

  const rows = events
    .filter((e) => idByCode.has(e.code))
    .map((e) => ({
      linkId: idByCode.get(e.code)!,
      ts: new Date(e.ts),
      referrer: e.referrer ?? null,
      country: e.country ?? null,
      uaHash: e.uaHash ?? null,
    }));

  if (rows.length === 0) return 0;

  const countByLink = new Map<number, number>();
  for (const r of rows) countByLink.set(r.linkId, (countByLink.get(r.linkId) ?? 0) + 1);

  await prisma.$transaction([
    prisma.click.createMany({ data: rows }),
    ...[...countByLink.entries()].map(([linkId, inc]) =>
      prisma.link.update({ where: { id: linkId }, data: { clickCount: { increment: inc } } }),
    ),
  ]);

  return rows.length;
}

let timer: NodeJS.Timeout | null = null;

export function startFlushLoop(): void {
  if (timer) return;
  timer = setInterval(() => {
    flushClicks().catch((err) => console.error('[flush] error:', (err as Error).message));
  }, env.FLUSH_INTERVAL_MS);
  // Don't keep the process alive solely for the flush timer.
  timer.unref?.();
}

export function stopFlushLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
