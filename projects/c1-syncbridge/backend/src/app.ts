import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health.routes';
import { connectorsRouter } from './routes/connectors.routes';
import { flowsRouter } from './routes/flows.routes';
import { runsRouter } from './routes/runs.routes';
import { notFound, errorHandler } from './middleware/errorHandler';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '512kb' }));

  app.use('/healthz', healthRouter);
  app.use('/api/connectors', connectorsRouter);
  app.use('/api/flows', flowsRouter);
  app.use('/api/runs', runsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
