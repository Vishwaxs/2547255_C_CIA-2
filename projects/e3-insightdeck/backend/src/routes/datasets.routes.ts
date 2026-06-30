import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validateBody } from '../middleware/validate';
import { HttpError } from '../middleware/errorHandler';
import { ingestDataset, deleteDataset, seedDataset } from '../services/dataset.service';

export const datasetsRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  csv: z.string().min(1),
  source: z.enum(['upload', 'paste', 'seed']).default('paste'),
});

// POST /api/datasets — ingest a CSV (parse + infer types + profile).
datasetsRouter.post(
  '/',
  validateBody(createSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof createSchema>;
      const result = await ingestDataset(body);
      res.status(result.created ? 201 : 200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/datasets/seed — load the built-in demo dataset.
datasetsRouter.post('/seed', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await seedDataset();
    res.status(result.created ? 201 : 200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/datasets — list with column/row counts.
datasetsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const datasets = await prisma.dataset.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        source: true,
        rowCount: true,
        columnCount: true,
        createdAt: true,
        _count: { select: { decks: true } },
      },
    });
    res.json(
      datasets.map((d) => ({
        id: d.id,
        name: d.name,
        source: d.source,
        rowCount: d.rowCount,
        columnCount: d.columnCount,
        deckCount: d._count.decks,
        createdAt: d.createdAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/datasets/:id — dataset + column profiles + a sample of rows.
datasetsRouter.get(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const dataset = await prisma.dataset.findUnique({
        where: { id: req.params.id },
        include: { columns: { orderBy: { index: 'asc' } } },
      });
      if (!dataset) throw new HttpError(404, 'Dataset not found');
      const rows = (dataset.rows as Record<string, string>[]) ?? [];
      res.json({
        id: dataset.id,
        name: dataset.name,
        source: dataset.source,
        rowCount: dataset.rowCount,
        columnCount: dataset.columnCount,
        createdAt: dataset.createdAt,
        columns: dataset.columns,
        sampleRows: rows.slice(0, 20),
      });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/datasets/:id — delete dataset (cascades to columns/decks/insights).
datasetsRouter.delete(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const ok = await deleteDataset(req.params.id);
      if (!ok) throw new HttpError(404, 'Dataset not found');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
