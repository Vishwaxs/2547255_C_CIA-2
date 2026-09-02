import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { triggerRun } from '../engine/runner';
import { validateBody } from '../middleware/validate';
import { HttpError } from '../middleware/errorHandler';

export const runsRouter = Router();

const triggerSchema = z.object({
  suiteId: z.string().min(1),
});

// POST /api/runs — trigger a new run (async; returns run id immediately)
runsRouter.post('/', validateBody(triggerSchema), async (req, res, next) => {
  try {
    const { suiteId } = req.body as { suiteId: string };
    const runId = await triggerRun(suiteId);
    res.status(202).json({ id: runId, status: 'running' });
  } catch (err) {
    next(err);
  }
});

// GET /api/runs/:id — run detail with all results
runsRouter.get('/:id', async (req, res, next) => {
  try {
    const run = await prisma.run.findUnique({
      where: { id: req.params.id },
      include: {
        results: {
          include: { testCase: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!run) throw new HttpError(404, 'Run not found');
    res.json(run);
  } catch (err) {
    next(err);
  }
});

// GET /api/runs?suiteId=... — list runs for a suite
runsRouter.get('/', async (req, res, next) => {
  try {
    const { suiteId } = req.query as { suiteId?: string };
    const runs = await prisma.run.findMany({
      where: suiteId ? { suiteId } : undefined,
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        suiteId: true,
        triggeredBy: true,
        startedAt: true,
        completedAt: true,
        totalTests: true,
        passed: true,
        failed: true,
      },
    });
    res.json(runs);
  } catch (err) {
    next(err);
  }
});
