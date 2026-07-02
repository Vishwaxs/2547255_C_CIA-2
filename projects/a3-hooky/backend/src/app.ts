import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health.routes';
import { subscriptionsRouter } from './routes/subscriptions.routes';
import { eventsRouter } from './routes/events.routes';
import { deliveriesRouter } from './routes/deliveries.routes';
import { statsRouter } from './routes/stats.routes';
import { notFound, errorHandler } from './middleware/errorHandler';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/healthz', healthRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/deliveries', deliveriesRouter);
  app.use('/api/stats', statsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
