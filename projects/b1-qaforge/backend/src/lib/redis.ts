import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, { lazyConnect: true });

redis.on('error', (err: Error) => {
  console.error('[redis] connection error:', err.message);
});
