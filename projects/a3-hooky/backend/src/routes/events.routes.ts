import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { publishEvent } from '../services/dispatch.service';

export const eventsRouter = Router();

const publishSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.any()).default({}),
  idempotencyKey: z.string().optional(),
});

// POST /api/events — publish an event; fans out to matching subscriptions.
eventsRouter.post('/', validateBody(publishSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof publishSchema>;
    const result = await publishEvent(body);
    res.status(202).json({ eventId: result.event.id, deliveries: result.deliveryCount, deduped: result.deduped });
  } catch (err) {
    next(err);
  }
});
