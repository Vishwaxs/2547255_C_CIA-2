import { Router, Request, Response, NextFunction } from 'express';
import { recentAlerts } from '../services/alert.service';

export const alertsRouter = Router();

// GET /api/alerts — recent alerts (most recent first).
alertsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await recentAlerts(50));
  } catch (err) {
    next(err);
  }
});
