import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { describeAgent, agentStats } from '../services/agent.service';

// Read-only windows onto the world the agent acts in, plus its own configuration. Without
// these the trace is unfalsifiable: you can see the agent claim it found an article, but
// not check that the article exists or that the order really did flip to refunded.
export const worldRouter = Router();

worldRouter.get('/kb', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await prisma.knowledgeArticle.findMany({ orderBy: { createdAt: 'asc' } }));
  } catch (err) {
    next(err);
  }
});

worldRouter.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    res.json(
      await prisma.order.findMany({
        where: customerId ? { customerId } : undefined,
        orderBy: { placedAt: 'desc' },
      }),
    );
  } catch (err) {
    next(err);
  }
});

worldRouter.get('/agent', (_req: Request, res: Response) => {
  res.json(describeAgent());
});

worldRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await agentStats());
  } catch (err) {
    next(err);
  }
});
