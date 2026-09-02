import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export const statsRouter = Router();

// GET /api/stats — corpus-wide analytics for the dashboard.
statsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [datasetCount, deckCount, insightCount, byType] = await Promise.all([
      prisma.dataset.count(),
      prisma.deck.count(),
      prisma.insight.count(),
      prisma.insight.groupBy({ by: ['type'], _count: { _all: true } }),
    ]);

    res.json({
      datasetCount,
      deckCount,
      insightCount,
      avgInsightsPerDeck: deckCount > 0 ? insightCount / deckCount : 0,
      insightsByType: byType
        .map((b) => ({ type: b.type, count: b._count._all }))
        .sort((a, b) => b.count - a.count),
    });
  } catch (err) {
    next(err);
  }
});
