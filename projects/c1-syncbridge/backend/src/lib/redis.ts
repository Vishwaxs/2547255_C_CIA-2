import Redis from 'ioredis';
import { env } from '../config/env';

// Shared connection for health checks. BullMQ creates its own connections
// (it requires maxRetriesPerRequest: null), configured in queue/sync.queue.ts.
export const redis = new Redis(env.REDIS_URL, { lazyConnect: true });

redis.on('error', (err: Error) => {
  console.error('[redis] connection error:', err.message);
});
