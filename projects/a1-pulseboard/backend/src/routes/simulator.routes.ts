import { Router, Request, Response, NextFunction } from 'express';
import { startSimulator, stopSimulator, simulatorRunning } from '../services/simulator';
import { seedMetrics } from '../services/seed.service';

export const simulatorRouter = Router();

// POST /api/simulator/start — ensure the demo metrics exist, then start generating events.
simulatorRouter.post('/start', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await seedMetrics();
    startSimulator();
    res.json({ running: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/simulator/stop — stop generating events.
simulatorRouter.post('/stop', (_req: Request, res: Response) => {
  stopSimulator();
  res.json({ running: false });
});

// GET /api/simulator — current simulator state.
simulatorRouter.get('/', (_req: Request, res: Response) => {
  res.json({ running: simulatorRunning() });
});
