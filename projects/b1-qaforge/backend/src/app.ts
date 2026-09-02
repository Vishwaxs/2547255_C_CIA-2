import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health.routes';
import { suitesRouter } from './routes/suites.routes';
import { runsRouter } from './routes/runs.routes';
import { notFound, errorHandler } from './middleware/errorHandler';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '256kb' }));

  app.use('/healthz', healthRouter);
  app.use('/api/suites', suitesRouter);
  app.use('/api/runs', runsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
