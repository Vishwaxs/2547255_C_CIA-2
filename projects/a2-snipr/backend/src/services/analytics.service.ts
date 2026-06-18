import { prisma } from '../lib/prisma';

export interface LinkStats {
  code: string;
  targetUrl: string;
  totalClicks: number;
  createdAt: Date;
  byDay: { day: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  topCountries: { country: string; count: number }[];
}

// Aggregate analytics for one code. The three roll-ups (clicks per day, top
// referrers, top countries) are grouped in the database rather than in Node, so
// the work scales with the number of distinct buckets, not raw click volume.
// COUNT(*) comes back as bigint from Postgres, hence the Number() coercion.
export async function getStats(code: string): Promise<LinkStats | null> {
  const link = await prisma.link.findUnique({ where: { code } });
  if (!link) return null;

  const [byDay, topReferrers, topCountries] = await Promise.all([
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT to_char(date_trunc('day', ts), 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
      FROM clicks WHERE link_id = ${link.id}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ referrer: string | null; count: bigint }[]>`
      SELECT COALESCE(referrer, 'direct') AS referrer, COUNT(*)::bigint AS count
      FROM clicks WHERE link_id = ${link.id}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    prisma.$queryRaw<{ country: string | null; count: bigint }[]>`
      SELECT COALESCE(country, 'unknown') AS country, COUNT(*)::bigint AS count
      FROM clicks WHERE link_id = ${link.id}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
  ]);

  return {
    code: link.code,
    targetUrl: link.targetUrl,
    totalClicks: link.clickCount,
    createdAt: link.createdAt,
    byDay: byDay.map((r) => ({ day: r.day, count: Number(r.count) })),
    topReferrers: topReferrers.map((r) => ({ referrer: r.referrer ?? 'direct', count: Number(r.count) })),
    topCountries: topCountries.map((r) => ({ country: r.country ?? 'unknown', count: Number(r.count) })),
  };
}
