import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health.routes';
import { documentsRouter } from './routes/documents.routes';
import { queryRouter } from './routes/query.routes';
import { queriesRouter } from './routes/queries.routes';
import { statsRouter } from './routes/stats.routes';
import { notFound, errorHandler } from './middleware/errorHandler';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  // Documents can be pasted in full, so allow a generous JSON body.
  app.use(express.json({ limit: '4mb' }));

  app.use('/healthz', healthRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/query', queryRouter);
  app.use('/api/queries', queriesRouter);
  app.use('/api/stats', statsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
