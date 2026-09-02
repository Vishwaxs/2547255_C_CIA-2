import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';
import { replay } from '../services/dispatch.service';

export const deliveriesRouter = Router();

// GET /api/deliveries?status= — recent deliveries (optionally filtered by status).
deliveriesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const deliveries = await prisma.delivery.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        subscription: { select: { name: true, mode: true, endpoint: true } },
        event: { select: { type: true } },
      },
    });
    res.json(deliveries);
  } catch (err) {
    next(err);
  }
});

// GET /api/deliveries/:id — a delivery with its full attempt log.
deliveriesRouter.get('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const delivery = await prisma.delivery.findUnique({
      where: { id: req.params.id },
      include: {
        attemptLog: { orderBy: { at: 'asc' } },
        subscription: { select: { name: true, mode: true, endpoint: true } },
        event: { select: { type: true, payload: true } },
      },
    });
    if (!delivery) throw new HttpError(404, 'Delivery not found');
    res.json(delivery);
  } catch (err) {
    next(err);
  }
});

// POST /api/deliveries/:id/replay — re-queue a delivery for a fresh run.
deliveriesRouter.post('/:id/replay', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    res.json(await replay(req.params.id));
  } catch (err) {
    next(err);
  }
});
