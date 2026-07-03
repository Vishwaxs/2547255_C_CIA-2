import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { validateBody } from '../middleware/validate';
import { HttpError } from '../middleware/errorHandler';

export const flagsRouter = Router();

const serveSchema = z.object({
  variationKey: z.string().optional(),
  rollout: z.array(z.object({ variationKey: z.string(), weight: z.number().nonnegative() })).optional(),
});

const createSchema = z
  .object({
    key: z.string().min(1).regex(/^[a-zA-Z0-9._-]+$/, 'key must be url-safe'),
    name: z.string().min(1),
    description: z.string().optional(),
    enabled: z.boolean().default(true),
    variations: z.array(z.object({ key: z.string().min(1), value: z.any() })).min(2),
    fallthrough: serveSchema,
    offVariationKey: z.string().min(1),
  })
  .refine((f) => f.variations.some((v) => v.key === f.offVariationKey), {
    message: 'offVariationKey must reference a variation',
  });

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  fallthrough: serveSchema.optional(),
  offVariationKey: z.string().min(1).optional(),
});

// POST /api/flags
flagsRouter.post('/', validateBody(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = req.body as z.infer<typeof createSchema>;
    const flag = await prisma.flag.create({
      data: {
        key: b.key,
        name: b.name,
        description: b.description,
        enabled: b.enabled,
        variations: b.variations as Prisma.InputJsonValue,
        fallthrough: b.fallthrough as Prisma.InputJsonValue,
        offVariationKey: b.offVariationKey,
      },
    });
    res.status(201).json(flag);
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return next(new HttpError(409, 'Flag key already exists'));
    next(err);
  }
});

// GET /api/flags
flagsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await prisma.flag.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { rules: true } } } }));
  } catch (err) {
    next(err);
  }
});

// GET /api/flags/:key
flagsRouter.get('/:key', async (req: Request<{ key: string }>, res: Response, next: NextFunction) => {
  try {
    const flag = await prisma.flag.findUnique({ where: { key: req.params.key }, include: { rules: { orderBy: { order: 'asc' } } } });
    if (!flag) throw new HttpError(404, 'Flag not found');
    res.json(flag);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/flags/:key
flagsRouter.patch('/:key', validateBody(patchSchema), async (req: Request<{ key: string }>, res: Response, next: NextFunction) => {
  try {
    const b = req.body as z.infer<typeof patchSchema>;
    const flag = await prisma.flag.update({
      where: { key: req.params.key },
      data: { ...b, fallthrough: b.fallthrough ? (b.fallthrough as Prisma.InputJsonValue) : undefined },
    });
    res.json(flag);
  } catch {
    next(new HttpError(404, 'Flag not found'));
  }
});

// DELETE /api/flags/:key
flagsRouter.delete('/:key', async (req: Request<{ key: string }>, res: Response, next: NextFunction) => {
  try {
    await prisma.flag.delete({ where: { key: req.params.key } });
    res.status(204).end();
  } catch {
    next(new HttpError(404, 'Flag not found'));
  }
});
