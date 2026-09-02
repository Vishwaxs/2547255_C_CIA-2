import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { validateBody } from '../middleware/validate';
import { HttpError } from '../middleware/errorHandler';
import { TRANSFORMS } from '../engine/mapping';
import { CONFLICT_STRATEGIES } from '../engine/conflict';
import { createRun, runSync } from '../engine/sync';
import { enqueueSync, registerSchedule, unregisterSchedule } from '../queue/sync.queue';

export const flowsRouter = Router();

const mappingSchema = z.object({
  sourceField: z.string().min(1),
  targetField: z.string().min(1),
  transform: z.enum(TRANSFORMS).default('none'),
});

const createSchema = z.object({
  name: z.string().min(1),
  sourceConnectorId: z.string().min(1),
  targetConnectorId: z.string().min(1),
  schedule: z.string().min(1).nullable().optional(),
  enabled: z.boolean().default(true),
  conflictStrategy: z.enum(CONFLICT_STRATEGIES).default('source_wins'),
  mappings: z.array(mappingSchema).default([]),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  schedule: z.string().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
  conflictStrategy: z.enum(CONFLICT_STRATEGIES).optional(),
});

// Best-effort schedule sync — never let a Redis hiccup break flow CRUD.
async function syncSchedule(flow: { id: string; schedule: string | null; enabled: boolean }) {
  if (!env.START_WORKER) return;
  try {
    if (flow.enabled && flow.schedule) {
      await registerSchedule(flow.id, flow.schedule);
    } else {
      await unregisterSchedule(flow.id);
    }
  } catch (err) {
    console.error('[flows] schedule sync failed:', (err as Error).message);
  }
}

// POST /api/flows
flowsRouter.post(
  '/',
  validateBody(createSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof createSchema>;
      const [source, target] = await Promise.all([
        prisma.connector.findUnique({ where: { id: body.sourceConnectorId } }),
        prisma.connector.findUnique({ where: { id: body.targetConnectorId } }),
      ]);
      if (!source) throw new HttpError(400, 'sourceConnectorId not found');
      if (!target) throw new HttpError(400, 'targetConnectorId not found');

      const flow = await prisma.syncFlow.create({
        data: {
          name: body.name,
          sourceConnectorId: body.sourceConnectorId,
          targetConnectorId: body.targetConnectorId,
          schedule: body.schedule ?? null,
          enabled: body.enabled,
          conflictStrategy: body.conflictStrategy,
          mappings: { create: body.mappings },
        },
        include: { mappings: true },
      });
      await syncSchedule(flow);
      res.status(201).json(flow);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/flows
flowsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const flows = await prisma.syncFlow.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sourceConnector: { select: { id: true, name: true, kind: true } },
        targetConnector: { select: { id: true, name: true, kind: true } },
        _count: { select: { mappings: true } },
        runs: { orderBy: { startedAt: 'desc' }, take: 1 },
      },
    });
    res.json(
      flows.map((f) => ({
        id: f.id,
        name: f.name,
        sourceConnector: f.sourceConnector,
        targetConnector: f.targetConnector,
        schedule: f.schedule,
        enabled: f.enabled,
        conflictStrategy: f.conflictStrategy,
        lastSyncedAt: f.lastSyncedAt,
        mappingCount: f._count.mappings,
        lastRun: f.runs[0] ?? null,
        createdAt: f.createdAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/flows/:id
flowsRouter.get(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const flow = await prisma.syncFlow.findUnique({
        where: { id: req.params.id },
        include: {
          sourceConnector: { select: { id: true, name: true, kind: true } },
          targetConnector: { select: { id: true, name: true, kind: true } },
          mappings: { orderBy: { createdAt: 'asc' } },
          runs: { orderBy: { startedAt: 'desc' }, take: 10 },
        },
      });
      if (!flow) throw new HttpError(404, 'Flow not found');
      res.json(flow);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/flows/:id
flowsRouter.patch(
  '/:id',
  validateBody(updateSchema),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const exists = await prisma.syncFlow.findUnique({ where: { id: req.params.id } });
      if (!exists) throw new HttpError(404, 'Flow not found');
      const flow = await prisma.syncFlow.update({
        where: { id: req.params.id },
        data: req.body as z.infer<typeof updateSchema>,
      });
      await syncSchedule(flow);
      res.json(flow);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/flows/:id
flowsRouter.delete(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const exists = await prisma.syncFlow.findUnique({ where: { id: req.params.id } });
      if (!exists) throw new HttpError(404, 'Flow not found');
      await unregisterSchedule(req.params.id).catch(() => undefined);
      await prisma.syncFlow.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/flows/:id/trigger — manual / event sync.
// With a worker running, enqueue and return 202 + run id (frontend polls).
// Without one (tests), run inline and return the completed run synchronously.
flowsRouter.post(
  '/:id/trigger',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const flowId = req.params.id;
      const flow = await prisma.syncFlow.findUnique({ where: { id: flowId } });
      if (!flow) throw new HttpError(404, 'Flow not found');

      if (env.START_WORKER) {
        const runId = await createRun(flowId, 'event');
        try {
          await enqueueSync(runId);
        } catch (err) {
          // Redis unavailable — fall back to running inline so the trigger still works.
          console.error('[flows] enqueue failed, running inline:', (err as Error).message);
          const { executeRun } = await import('../engine/sync');
          executeRun(runId).catch((e) => console.error('[flows] inline run failed:', e.message));
        }
        res.status(202).json({ id: runId, status: 'running' });
      } else {
        const runId = await runSync(flowId, 'manual');
        const run = await prisma.syncRun.findUnique({ where: { id: runId } });
        res.status(200).json(run);
      }
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/flows/:id/runs — recent runs for a flow
flowsRouter.get(
  '/:id/runs',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const runs = await prisma.syncRun.findMany({
        where: { flowId: req.params.id },
        orderBy: { startedAt: 'desc' },
        take: 50,
      });
      res.json(runs);
    } catch (err) {
      next(err);
    }
  },
);
