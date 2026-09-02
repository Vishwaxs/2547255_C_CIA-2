import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { validateBody } from '../middleware/validate';
import { HttpError } from '../middleware/errorHandler';
import { generateSecret } from '../engine/sign';
import { seedSubscriptions } from '../services/subscription.service';

export const subscriptionsRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  endpoint: z.string().min(1),
  eventTypes: z.array(z.string().min(1)).min(1).default(['*']),
  secret: z.string().optional(),
  mode: z.enum(['ok', 'flaky', 'fail', 'slow']).default('ok'),
  maxAttempts: z.number().int().positive().max(20).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  endpoint: z.string().min(1).optional(),
  eventTypes: z.array(z.string().min(1)).min(1).optional(),
  mode: z.enum(['ok', 'flaky', 'fail', 'slow']).optional(),
  active: z.boolean().optional(),
  maxAttempts: z.number().int().positive().max(20).optional(),
});

// POST /api/subscriptions
subscriptionsRouter.post('/', validateBody(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = req.body as z.infer<typeof createSchema>;
    const sub = await prisma.subscription.create({
      data: {
        name: b.name,
        endpoint: b.endpoint,
        eventTypes: b.eventTypes as Prisma.InputJsonValue,
        secret: b.secret ?? generateSecret(),
        mode: b.mode,
        maxAttempts: b.maxAttempts ?? env.DEFAULT_MAX_ATTEMPTS,
      },
    });
    res.status(201).json(sub);
  } catch (err) {
    next(err);
  }
});

// POST /api/subscriptions/seed
subscriptionsRouter.post('/seed', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await seedSubscriptions());
  } catch (err) {
    next(err);
  }
});

// GET /api/subscriptions
subscriptionsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await prisma.subscription.findMany({ orderBy: { createdAt: 'desc' } }));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/subscriptions/:id
subscriptionsRouter.patch('/:id', validateBody(patchSchema), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const b = req.body as z.infer<typeof patchSchema>;
    const sub = await prisma.subscription.update({
      where: { id: req.params.id },
      data: {
        ...b,
        eventTypes: b.eventTypes ? (b.eventTypes as Prisma.InputJsonValue) : undefined,
      },
    });
    res.json(sub);
  } catch {
    next(new HttpError(404, 'Subscription not found'));
  }
});

// DELETE /api/subscriptions/:id
subscriptionsRouter.delete('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await prisma.subscription.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    next(new HttpError(404, 'Subscription not found'));
  }
});
