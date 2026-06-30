import Redis from 'ioredis';
import { env } from '../config/env';

// Shared connection used by the deck cache and the health check. lazyConnect so a
// Redis outage never blocks startup — every cache call is wrapped to fail open.
export const redis = new Redis(env.REDIS_URL, { lazyConnect: true });

redis.on('error', (err: Error) => {
  console.error('[redis] connection error:', err.message);
});
