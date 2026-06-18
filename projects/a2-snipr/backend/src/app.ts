import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { linksRouter } from './routes/links.routes';
import { redirectRouter } from './routes/redirect.routes';
import { healthRouter } from './routes/health.routes';
import { errorHandler, notFound } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  // Respect X-Forwarded-For so rate limiting / geo see the real client IP when
  // deployed behind a proxy (Render, Vercel, etc.).
  app.set('trust proxy', true);

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '64kb' }));

  // Order matters: specific API + health routes first, then the catch-all
  // redirect at the root so GET /:code doesn't shadow /api/* or /healthz.
  app.use(healthRouter);
  app.use('/api/links', linksRouter);
  app.use(redirectRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
