import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { ingestEvent } from '../services/ingest.service';

export const eventsRouter = Router();

const eventSchema = z.object({
  metric: z.string().min(1),
  value: z.number(),
  tags: z.record(z.any()).optional(),
  ts: z.number().int().optional(),
});
// Accept a single event or a batch.
const bodySchema = z.union([eventSchema, z.array(eventSchema).min(1).max(1000)]);

// POST /api/events — ingest one event or a batch.
eventsRouter.post('/', validateBody(bodySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof bodySchema>;
    const events = Array.isArray(body) ? body : [body];
    let ingested = 0;
    for (const e of events) {
      await ingestEvent(e);
      ingested++;
    }
    res.status(202).json({ ingested });
  } catch (err) {
    next(err);
  }
});
