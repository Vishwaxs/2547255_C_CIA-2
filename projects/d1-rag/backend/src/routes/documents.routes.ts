import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validateBody } from '../middleware/validate';
import { HttpError } from '../middleware/errorHandler';
import { ingestDocument, deleteDocument } from '../services/index.service';
import { seedCorpus } from '../services/seed.service';

export const documentsRouter = Router();

const createSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  source: z.enum(['upload', 'paste', 'seed']).default('paste'),
});

// POST /api/documents — ingest a document (chunk + embed + index).
documentsRouter.post(
  '/',
  validateBody(createSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof createSchema>;
      const result = await ingestDocument(body);
      res.status(result.created ? 201 : 200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/documents/seed — load the built-in demo corpus.
documentsRouter.post('/seed', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await seedCorpus();
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/documents — list documents with chunk counts.
documentsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const docs = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { chunks: true } } },
    });
    res.json(
      docs.map((d) => ({
        id: d.id,
        title: d.title,
        source: d.source,
        charCount: d.charCount,
        chunkCount: d._count.chunks,
        createdAt: d.createdAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id — a document with its chunks (text + offsets, no vectors).
documentsRouter.get(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const doc = await prisma.document.findUnique({
        where: { id: req.params.id },
        include: {
          chunks: {
            orderBy: { index: 'asc' },
            select: {
              id: true,
              index: true,
              text: true,
              charStart: true,
              charEnd: true,
              tokenCount: true,
            },
          },
        },
      });
      if (!doc) throw new HttpError(404, 'Document not found');
      res.json(doc);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/documents/:id — delete the document (cascades to chunks) and re-index.
documentsRouter.delete(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const ok = await deleteDocument(req.params.id);
      if (!ok) throw new HttpError(404, 'Document not found');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
