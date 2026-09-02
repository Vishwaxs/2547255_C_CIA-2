import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { validateBody } from '../middleware/validate';
import { HttpError } from '../middleware/errorHandler';
import { invalidateFlag } from '../services/flag.service';

// Mounted at /api/flags/:key/rules (mergeParams to see :key).
export const rulesRouter = Router({ mergeParams: true });

const OPS = ['eq', 'neq', 'in', 'notIn', 'contains', 'startsWith', 'gt', 'gte', 'lt', 'lte', 'exists'] as const;

const serveSchema = z.object({
  variationKey: z.string().optional(),
  rollout: z.array(z.object({ variationKey: z.string(), weight: z.number().nonnegative() })).optional(),
});

const createSchema = z.object({
  description: z.string().optional(),
  conditions: z.array(z.object({ attribute: z.string().min(1), op: z.enum(OPS), values: z.array(z.any()).default([]) })).default([]),
  serve: serveSchema,
  order: z.number().int().nonnegative().optional(),
});

async function flagByKey(key: string) {
  const flag = await prisma.flag.findUnique({ where: { key } });
  if (!flag) throw new HttpError(404, 'Flag not found');
  return flag;
}

// POST /api/flags/:key/rules
rulesRouter.post('/', validateBody(createSchema), async (req: Request<{ key: string }>, res: Response, next: NextFunction) => {
  try {
    const flag = await flagByKey(req.params.key);
    const b = req.body as z.infer<typeof createSchema>;
    const order = b.order ?? ((await prisma.rule.aggregate({ where: { flagId: flag.id }, _max: { order: true } }))._max.order ?? -1) + 1;
    const rule = await prisma.rule.create({
      data: {
        flagId: flag.id,
        order,
        description: b.description,
        conditions: b.conditions as Prisma.InputJsonValue,
        serve: b.serve as Prisma.InputJsonValue,
      },
    });
    await invalidateFlag(req.params.key);
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/flags/:key/rules/:ruleId
rulesRouter.delete('/:ruleId', async (req: Request<{ key: string; ruleId: string }>, res: Response, next: NextFunction) => {
  try {
    await flagByKey(req.params.key);
    await prisma.rule.delete({ where: { id: req.params.ruleId } });
    await invalidateFlag(req.params.key);
    res.status(204).end();
  } catch {
    next(new HttpError(404, 'Rule not found'));
  }
});
