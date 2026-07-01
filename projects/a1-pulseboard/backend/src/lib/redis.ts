import Redis from 'ioredis';
import { env } from '../config/env';

// The live sliding-window aggregates live in Redis (sorted sets per metric). lazyConnect
// so startup never blocks; aggregation falls back to Postgres if Redis is unavailable.
export const redis = new Redis(env.REDIS_URL, { lazyConnect: true });

redis.on('error', (err: Error) => {
  console.error('[redis] connection error:', err.message);
});
