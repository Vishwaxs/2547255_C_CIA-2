import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health.routes';
import { runsRouter } from './routes/runs.routes';
import { notFound, errorHandler } from './middleware/errorHandler';

// suites router added in Phase 2 — imported lazily to keep phases clean
let suitesRouter: express.Router | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  suitesRouter = require('./routes/suites.routes').suitesRouter as express.Router;
} catch {
  // suites routes not yet wired (Phase 1 only)
}

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '256kb' }));

  app.use('/healthz', healthRouter);
  if (suitesRouter) app.use('/api/suites', suitesRouter);
  app.use('/api/runs', runsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
