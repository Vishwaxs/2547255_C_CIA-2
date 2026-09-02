import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';

export const statsRouter = Router({ mergeParams: true });

// GET /api/flags/:key/stats — exposure counts per served variation (the experiment split).
statsRouter.get('/', async (req: Request<{ key: string }>, res: Response, next: NextFunction) => {
  try {
    const flag = await prisma.flag.findUnique({ where: { key: req.params.key } });
    if (!flag) throw new HttpError(404, 'Flag not found');
    const [byVariation, byReason, total] = await Promise.all([
      prisma.exposure.groupBy({ by: ['variationKey'], where: { flagId: flag.id }, _count: { _all: true } }),
      prisma.exposure.groupBy({ by: ['reason'], where: { flagId: flag.id }, _count: { _all: true } }),
      prisma.exposure.count({ where: { flagId: flag.id } }),
    ]);
    res.json({
      flag: flag.key,
      totalExposures: total,
      byVariation: byVariation
        .map((r) => ({ variationKey: r.variationKey, count: r._count._all, share: total ? r._count._all / total : 0 }))
        .sort((a, b) => b.count - a.count),
      byReason: byReason.map((r) => ({ reason: r.reason, count: r._count._all })),
    });
  } catch (err) {
    next(err);
  }
});
