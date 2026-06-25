import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export const statsRouter = Router();

// GET /api/stats — corpus + query analytics for the dashboard.
// Roll-ups (per-day, top-cited docs) are grouped in the database; COUNT(*) returns
// bigint from Postgres, hence the Number() coercion.
statsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalQueries,
      refusedQueries,
      cacheHits,
      latency,
      topScore,
      documentCount,
      chunkCount,
      perDay,
      topCitedDocs,
    ] = await Promise.all([
      prisma.query.count(),
      prisma.query.count({ where: { refused: true } }),
      prisma.query.count({ where: { cacheHit: true } }),
      prisma.query.aggregate({ _avg: { latencyMs: true } }),
      prisma.query.aggregate({ _avg: { topScore: true } }),
      prisma.document.count(),
      prisma.chunk.count(),
      prisma.$queryRaw<{ day: string; total: bigint; answered: bigint }[]>`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
               COUNT(*)::bigint AS total,
               COUNT(*) FILTER (WHERE "refused" = false)::bigint AS answered
        FROM "Query"
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ title: string; citations: bigint }[]>`
        SELECT d."title" AS title, COUNT(*)::bigint AS citations
        FROM "Retrieval" r
        JOIN "Chunk" c ON c."id" = r."chunkId"
        JOIN "Document" d ON d."id" = c."documentId"
        WHERE r."cited" = true
        GROUP BY d."title" ORDER BY 2 DESC LIMIT 10`,
    ]);

    const answered = totalQueries - refusedQueries;
    res.json({
      totalQueries,
      answered,
      refused: refusedQueries,
      answeredRate: totalQueries > 0 ? answered / totalQueries : 0,
      cacheHits,
      cacheHitRate: totalQueries > 0 ? cacheHits / totalQueries : 0,
      avgLatencyMs: Math.round(latency._avg.latencyMs ?? 0),
      avgTopScore: topScore._avg.topScore ?? 0,
      documentCount,
      chunkCount,
      queriesPerDay: perDay.map((r) => ({
        day: r.day,
        total: Number(r.total),
        answered: Number(r.answered),
      })),
      topCitedDocuments: topCitedDocs.map((r) => ({
        title: r.title,
        citations: Number(r.citations),
      })),
    });
  } catch (err) {
    next(err);
  }
});
