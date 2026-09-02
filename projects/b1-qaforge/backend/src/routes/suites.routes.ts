import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { validateBody } from '../middleware/validate';
import { HttpError } from '../middleware/errorHandler';
import { statsRouter } from './stats.routes';

export const suitesRouter = Router();

// Mount stats sub-router
suitesRouter.use('/:id/stats', statsRouter);

// ---- Schemas ---------------------------------------------------------------

const assertionSchema = z.union([
  z.object({ type: z.literal('status'), expected: z.number().int() }),
  z.object({
    type: z.literal('jsonBody'),
    field: z.string().min(1),
    op: z.enum(['truthy', 'eq']),
    expected: z.any().optional(),
  }),
  z.object({ type: z.literal('header'), field: z.string().min(1), contains: z.string() }),
]);

const caseSchema = z.object({
  name: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']).default('GET'),
  path: z.string().min(1),
  headers: z.record(z.string()).default({}),
  body: z.any().optional(),
  assertions: z.array(assertionSchema).default([]),
});

const createSuiteSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  baseUrl: z.string().url(),
  timeoutMs: z.number().int().positive().default(10000),
  cases: z.array(caseSchema).default([]),
});

const updateSuiteSchema = createSuiteSchema.omit({ cases: true }).partial();

type CaseInput = z.infer<typeof caseSchema>;

function caseToData(c: CaseInput): Omit<Prisma.TestCaseUncheckedCreateInput, 'suiteId'> {
  return {
    name: c.name,
    method: c.method,
    path: c.path,
    headers: c.headers as Prisma.InputJsonValue,
    body: c.body === undefined ? Prisma.JsonNull : (c.body as Prisma.InputJsonValue),
    assertions: c.assertions as unknown as Prisma.InputJsonValue,
  };
}

// ---- Routes ----------------------------------------------------------------

// POST /api/suites
suitesRouter.post(
  '/',
  validateBody(createSuiteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cases, ...suiteData } = req.body as z.infer<typeof createSuiteSchema>;
      const suite = await prisma.suite.create({
        data: {
          ...suiteData,
          cases:
            cases.length > 0
              ? { create: cases.map((c) => caseToData(c)) }
              : undefined,
        },
        include: { cases: true },
      });
      res.status(201).json(suite);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/suites
suitesRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const suites = await prisma.suite.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { cases: true } },
          runs: {
            orderBy: { startedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              startedAt: true,
              completedAt: true,
              totalTests: true,
              passed: true,
              failed: true,
            },
          },
        },
      });
      res.json(
        suites.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          baseUrl: s.baseUrl,
          timeoutMs: s.timeoutMs,
          createdAt: s.createdAt,
          caseCount: s._count.cases,
          lastRun: s.runs[0] ?? null,
        })),
      );
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/suites/:id
suitesRouter.get(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const suite = await prisma.suite.findUnique({
        where: { id: req.params.id },
        include: { cases: { orderBy: { createdAt: 'asc' } } },
      });
      if (!suite) throw new HttpError(404, 'Suite not found');
      res.json(suite);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/suites/:id
suitesRouter.patch(
  '/:id',
  validateBody(updateSuiteSchema),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const suite = await prisma.suite.findUnique({ where: { id: req.params.id } });
      if (!suite) throw new HttpError(404, 'Suite not found');
      const updated = await prisma.suite.update({
        where: { id: req.params.id },
        data: req.body as z.infer<typeof updateSuiteSchema>,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/suites/:id
suitesRouter.delete(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const suite = await prisma.suite.findUnique({ where: { id: req.params.id } });
      if (!suite) throw new HttpError(404, 'Suite not found');
      await prisma.suite.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/suites/:id/cases
suitesRouter.post(
  '/:id/cases',
  validateBody(caseSchema),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const suite = await prisma.suite.findUnique({ where: { id: req.params.id } });
      if (!suite) throw new HttpError(404, 'Suite not found');
      const tc = await prisma.testCase.create({
        data: {
          suiteId: req.params.id,
          ...caseToData(req.body as CaseInput),
        },
      });
      res.status(201).json(tc);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/suites/:id/cases
suitesRouter.get(
  '/:id/cases',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const suite = await prisma.suite.findUnique({ where: { id: req.params.id } });
      if (!suite) throw new HttpError(404, 'Suite not found');
      const cases = await prisma.testCase.findMany({
        where: { suiteId: req.params.id },
        orderBy: { createdAt: 'asc' },
      });
      res.json(cases);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/suites/:id/cases/:caseId
suitesRouter.delete(
  '/:id/cases/:caseId',
  async (req: Request<{ id: string; caseId: string }>, res: Response, next: NextFunction) => {
    try {
      const tc = await prisma.testCase.findFirst({
        where: { id: req.params.caseId, suiteId: req.params.id },
      });
      if (!tc) throw new HttpError(404, 'Test case not found');
      await prisma.testCase.delete({ where: { id: req.params.caseId } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
