import Redis from 'ioredis';
import { env } from '../config/env';

// Fail-open cache of assembled flag configs on the read-heavy evaluation path. lazyConnect
// so startup never blocks; every cache call is wrapped so a Redis outage just means a
// Postgres read.
export const redis = new Redis(env.REDIS_URL, { lazyConnect: true });

redis.on('error', (err: Error) => {
  console.error('[redis] connection error:', err.message);
});
