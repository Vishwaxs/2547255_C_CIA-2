import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health.routes';
import { datasetsRouter } from './routes/datasets.routes';
import { decksRouter } from './routes/decks.routes';
import { statsRouter } from './routes/stats.routes';
import { notFound, errorHandler } from './middleware/errorHandler';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  // Datasets are uploaded as raw CSV text, so allow a generous JSON body.
  app.use(express.json({ limit: '8mb' }));

  app.use('/healthz', healthRouter);
  app.use('/api/datasets', datasetsRouter);
  app.use('/api/decks', decksRouter);
  app.use('/api/stats', statsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
