import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health.routes';
import { ticketsRouter, seedHandler } from './routes/tickets.routes';
import { worldRouter } from './routes/world.routes';
import { notFound, errorHandler } from './middleware/errorHandler';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '512kb' }));

  app.use('/healthz', healthRouter);
  // Registered before the ticket router so the literal path is never captured by /:id.
  app.post('/api/seed', seedHandler);
  app.use('/api/tickets', ticketsRouter);
  app.use('/api/world', worldRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
