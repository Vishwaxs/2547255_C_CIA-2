import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';

export const queriesRouter = Router();

// GET /api/queries — recent query history (most recent first).
queriesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const queries = await prisma.query.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        question: true,
        refused: true,
        cacheHit: true,
        topScore: true,
        topK: true,
        threshold: true,
        latencyMs: true,
        embedderKind: true,
        generatorKind: true,
        createdAt: true,
      },
    });
    res.json(queries);
  } catch (err) {
    next(err);
  }
});

// GET /api/queries/:id — one query with its full retrieval audit (what was retrieved,
// each chunk's score + rank, and whether it was cited in the answer).
queriesRouter.get(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const query = await prisma.query.findUnique({
        where: { id: req.params.id },
        include: {
          retrievals: {
            orderBy: { rank: 'asc' },
            include: {
              chunk: {
                select: {
                  id: true,
                  index: true,
                  text: true,
                  charStart: true,
                  charEnd: true,
                  document: { select: { id: true, title: true } },
                },
              },
            },
          },
        },
      });
      if (!query) throw new HttpError(404, 'Query not found');
      res.json(query);
    } catch (err) {
      next(err);
    }
  },
);
