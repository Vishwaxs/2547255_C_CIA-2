import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let pgOk = false;
  let redisOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    pgOk = true;
  } catch {}
  try {
    await redis.ping();
    redisOk = true;
  } catch {}
  const status = pgOk && redisOk ? 200 : 503;
  res.status(status).json({ postgres: pgOk, redis: redisOk });
});
