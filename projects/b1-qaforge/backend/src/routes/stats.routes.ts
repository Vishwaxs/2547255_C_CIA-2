// Stats endpoint: flakiness scores + pass-rate trend per suite.
// Wired into suitesRouter as GET /api/suites/:id/stats

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';
import { env } from '../config/env';

export const statsRouter = Router({ mergeParams: true });

// GET /api/suites/:id/stats
statsRouter.get(
  '/',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const suite = await prisma.suite.findUnique({
        where: { id },
        include: { cases: { select: { id: true, name: true } } },
      });
      if (!suite) throw new HttpError(404, 'Suite not found');

      const window = env.FLAKINESS_WINDOW;

      // For each test case, fetch the last `window` results ordered by run creation.
      // Flakiness = count of status flips / (totalRuns - 1).
      const caseStats = await Promise.all(
        suite.cases.map(async (tc) => {
          const results = await prisma.runResult.findMany({
            where: { testCaseId: tc.id },
            orderBy: { run: { startedAt: 'asc' } },
            take: window,
            select: { status: true, durationMs: true },
          });

          const total = results.length;
          const passed = results.filter((r) => r.status === 'pass').length;
          const passRate = total > 0 ? passed / total : 0;
          const avgDurationMs =
            total > 0
              ? Math.round(results.reduce((s, r) => s + r.durationMs, 0) / total)
              : 0;

          let flips = 0;
          for (let i = 1; i < results.length; i++) {
            if (results[i].status !== results[i - 1].status) flips++;
          }
          const flakinessScore = total > 1 ? flips / (total - 1) : 0;

          return {
            testCaseId: tc.id,
            name: tc.name,
            totalRuns: total,
            passed,
            passRate: Math.round(passRate * 1000) / 1000,
            flakinessScore: Math.round(flakinessScore * 1000) / 1000,
            avgDurationMs,
          };
        }),
      );

      // Pass-rate trend: last 10 completed runs for the suite
      const recentRuns = await prisma.run.findMany({
        where: { suiteId: id, completedAt: { not: null } },
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          startedAt: true,
          totalTests: true,
          passed: true,
          failed: true,
        },
      });

      res.json({
        suiteId: id,
        suiteName: suite.name,
        caseStats: caseStats.sort((a, b) => b.flakinessScore - a.flakinessScore),
        passRateTrend: recentRuns.reverse().map((r) => ({
          runId: r.id,
          startedAt: r.startedAt,
          passRate: r.totalTests > 0 ? r.passed / r.totalTests : 0,
          totalTests: r.totalTests,
          passed: r.passed,
          failed: r.failed,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);
