import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { validateBody } from '../middleware/validate';
import { HttpError } from '../middleware/errorHandler';
import { CONNECTOR_KINDS } from '../connectors/connector';

export const connectorsRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(CONNECTOR_KINDS),
  config: z.record(z.any()).default({}),
});

const seedSchema = z.object({
  // Either pass explicit records, or a count of generated demo contacts.
  records: z
    .array(z.object({ externalId: z.string().min(1), data: z.record(z.any()) }))
    .optional(),
  count: z.number().int().positive().max(500).optional(),
});

// POST /api/connectors
connectorsRouter.post(
  '/',
  validateBody(createSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof createSchema>;
      const connector = await prisma.connector.create({
        data: { name: body.name, kind: body.kind, config: body.config as Prisma.InputJsonValue },
      });
      res.status(201).json(connector);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/connectors
connectorsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const connectors = await prisma.connector.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { records: true } } },
    });
    res.json(
      connectors.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        config: c.config,
        createdAt: c.createdAt,
        recordCount: c._count.records,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// POST /api/connectors/:id/seed — load demo data into the connected system
connectorsRouter.post(
  '/:id/seed',
  validateBody(seedSchema),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const connector = await prisma.connector.findUnique({ where: { id: req.params.id } });
      if (!connector) throw new HttpError(404, 'Connector not found');

      const body = req.body as z.infer<typeof seedSchema>;
      const records =
        body.records ?? generateDemoRecords(body.count ?? 3);

      for (const r of records) {
        await prisma.externalRecord.upsert({
          where: {
            connectorId_externalId: { connectorId: connector.id, externalId: r.externalId },
          },
          create: {
            connectorId: connector.id,
            externalId: r.externalId,
            data: r.data as Prisma.InputJsonValue,
          },
          update: { data: r.data as Prisma.InputJsonValue },
        });
      }
      res.status(201).json({ seeded: records.length });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/connectors/:id/records
connectorsRouter.get(
  '/:id/records',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const connector = await prisma.connector.findUnique({ where: { id: req.params.id } });
      if (!connector) throw new HttpError(404, 'Connector not found');
      const records = await prisma.externalRecord.findMany({
        where: { connectorId: req.params.id },
        orderBy: { externalId: 'asc' },
      });
      res.json(records);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/connectors/:id
connectorsRouter.delete(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const connector = await prisma.connector.findUnique({ where: { id: req.params.id } });
      if (!connector) throw new HttpError(404, 'Connector not found');
      await prisma.connector.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

function generateDemoRecords(count: number): { externalId: string; data: Record<string, unknown> }[] {
  const firstNames = ['Ada', 'Alan', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken'];
  const lastNames = ['Lovelace', 'Turing', 'Hopper', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson'];
  const out: { externalId: string; data: Record<string, unknown> }[] = [];
  for (let i = 0; i < count; i++) {
    const first = firstNames[i % firstNames.length];
    const last = lastNames[i % lastNames.length];
    out.push({
      externalId: `contact-${i + 1}`,
      data: {
        first_name: first,
        last_name: last,
        email: `  ${first}.${last}@example.com  `,
        company: 'Acme Inc',
        score: String((i + 1) * 10),
      },
    });
  }
  return out;
}
