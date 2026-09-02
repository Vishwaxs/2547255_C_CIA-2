import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { pingRedis } from '../lib/redis';

export const healthRouter = Router();

// Only Postgres is load-bearing. The Redis cache is fail-open, so a cache that is down —
// or deliberately not configured, as on serverless — is a degraded state, not an outage,
// and reporting 503 for it would take a working service out of a load balancer.
healthRouter.get('/', async (_req, res) => {
  let pgOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    pgOk = true;
  } catch {}

  const redis = await pingRedis();
  res.status(pgOk ? 200 : 503).json({
    postgres: pgOk,
    redis: redis === null ? 'not_configured' : redis,
  });
});
