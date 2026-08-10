import Redis from 'ioredis';
import { env } from '../config/env';

// Fail-open cache in front of the knowledge base. search_kb runs on every question-intent
// ticket and the KB is small and read-mostly, so it caches cleanly. lazyConnect means
// startup never blocks on Redis, and every call site swallows errors: a Redis outage
// degrades to a Postgres read, it never fails a request.
export const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });

redis.on('error', (err: Error) => {
  console.error('[redis] connection error:', err.message);
});

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (env.KB_CACHE_TTL_SECONDS === 0) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  if (env.KB_CACHE_TTL_SECONDS === 0) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', env.KB_CACHE_TTL_SECONDS);
  } catch {
    /* fail open — the cache is an optimization, never a correctness dependency */
  }
}

export async function cacheDrop(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    /* fail open */
  }
}
