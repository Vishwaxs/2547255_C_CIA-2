import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validateBody } from '../middleware/validate';
import { snapshot } from '../services/aggregate.service';
import { seedMetrics } from '../services/seed.service';

export const metricsRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  unit: z.string().default(''),
  description: z.string().optional(),
  thresholdType: z.enum(['none', 'max_avg', 'max_value', 'max_rate']).default('none'),
  thresholdValue: z.number().nullable().optional(),
});

// POST /api/metrics — define a metric (with an optional threshold).
metricsRouter.post('/', validateBody(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof createSchema>;
    const metric = await prisma.metric.upsert({
      where: { name: body.name },
      create: {
        name: body.name,
        unit: body.unit,
        description: body.description,
        thresholdType: body.thresholdType,
        thresholdValue: body.thresholdValue ?? null,
      },
      update: {
        unit: body.unit,
        description: body.description,
        thresholdType: body.thresholdType,
        thresholdValue: body.thresholdValue ?? null,
      },
    });
    res.status(201).json(metric);
  } catch (err) {
    next(err);
  }
});

// POST /api/metrics/seed — load the default demo metrics.
metricsRouter.post('/seed', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await seedMetrics());
  } catch (err) {
    next(err);
  }
});

// GET /api/metrics — list metrics with their current live snapshot.
metricsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await snapshot());
  } catch (err) {
    next(err);
  }
});
