import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { evaluateFlag, evaluateAll } from '../services/eval.service';

const ctxSchema = z.object({
  unitKey: z.string().min(1),
  attributes: z.record(z.any()).default({}),
});

// POST /api/flags/:key/evaluate — evaluate one flag for a context.
export const flagEvaluateRouter = Router({ mergeParams: true });
flagEvaluateRouter.post('/', validateBody(ctxSchema), async (req: Request<{ key: string }>, res: Response, next: NextFunction) => {
  try {
    const b = req.body as z.infer<typeof ctxSchema>;
    res.json(await evaluateFlag(req.params.key, b));
  } catch (err) {
    next(err);
  }
});

// POST /api/evaluate — evaluate every flag for a context (SDK-style).
export const evaluateAllRouter = Router();
evaluateAllRouter.post('/', validateBody(ctxSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = req.body as z.infer<typeof ctxSchema>;
    res.json({ unitKey: b.unitKey, flags: await evaluateAll(b) });
  } catch (err) {
    next(err);
  }
});
