import Redis from 'ioredis';
import { env } from '../config/env';

// Single shared connection used for cache reads, click counters and the click
// buffer. ioredis auto-reconnects on drops.
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  // Never crash the process on a transient Redis error — the read path is
  // written to degrade gracefully to Postgres when the cache is unavailable.
  console.error('[redis] connection error:', err.message);
});
