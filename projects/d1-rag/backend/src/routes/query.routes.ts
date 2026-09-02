import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { answerQuestion } from '../services/query.service';

export const queryRouter = Router();

const querySchema = z.object({
  question: z.string().min(1),
  topK: z.number().int().positive().max(50).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

// POST /api/query — answer a question over the corpus, with citations + retrieval audit.
queryRouter.post(
  '/',
  validateBody(querySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof querySchema>;
      const result = await answerQuestion(body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
