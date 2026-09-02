import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export const statsRouter = Router();

// GET /api/stats — delivery health for the dashboard.
statsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [byStatusRaw, subscriptions, events, attemptAgg] = await Promise.all([
      prisma.delivery.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.subscription.count(),
      prisma.event.count(),
      prisma.delivery.aggregate({ _avg: { attempts: true } }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const r of byStatusRaw) byStatus[r.status] = r._count._all;
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const delivered = byStatus.delivered ?? 0;
    const dead = byStatus.dead ?? 0;
    const terminal = delivered + dead;

    res.json({
      subscriptions,
      events,
      totalDeliveries: total,
      byStatus: ['pending', 'delivering', 'retrying', 'delivered', 'dead'].map((s) => ({
        status: s,
        count: byStatus[s] ?? 0,
      })),
      delivered,
      dead,
      successRate: terminal > 0 ? delivered / terminal : 0,
      avgAttempts: attemptAgg._avg.attempts ?? 0,
    });
  } catch (err) {
    next(err);
  }
});
