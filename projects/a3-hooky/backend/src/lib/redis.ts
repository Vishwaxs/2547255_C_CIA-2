import Redis from 'ioredis';
import { env } from '../config/env';

// Used for the fail-open idempotency cache on publish. lazyConnect so startup never blocks;
// a Redis outage simply disables dedupe (deliveries still work).
export const redis = new Redis(env.REDIS_URL, { lazyConnect: true });

redis.on('error', (err: Error) => {
  console.error('[redis] connection error:', err.message);
});
