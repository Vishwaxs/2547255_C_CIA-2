import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';

export const runsRouter = Router();

// GET /api/runs/:id — run detail with its per-record audit log
runsRouter.get(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const run = await prisma.syncRun.findUnique({
        where: { id: req.params.id },
        include: {
          flow: { select: { id: true, name: true, conflictStrategy: true } },
          entries: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!run) throw new HttpError(404, 'Run not found');
      res.json(run);
    } catch (err) {
      next(err);
    }
  },
);
