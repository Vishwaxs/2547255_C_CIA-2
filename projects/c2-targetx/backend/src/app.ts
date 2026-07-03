import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health.routes';
import { flagsRouter } from './routes/flags.routes';
import { notFound, errorHandler } from './middleware/errorHandler';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '512kb' }));

  app.use('/healthz', healthRouter);
  app.use('/api/flags', flagsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
