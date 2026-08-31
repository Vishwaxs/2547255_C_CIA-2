import Redis from 'ioredis';
import { env } from '../config/env';

// Fail-open cache in front of the knowledge base. search_kb runs on every question-intent
// ticket and the KB is small and read-mostly, so it caches cleanly. lazyConnect means
// startup never blocks on Redis, and every call site swallows errors: a Redis outage
// degrades to a Postgres read, it never fails a request.
// Fail-open only counts if it fails FAST. Measured with Redis killed, the defaults turned a
// 7ms agent run into a 7201ms one: ioredis queues commands while disconnected and waits for a
// reconnect, so every cache read paid the full reconnect timeout before the catch block ever
// ran. The caller still got a correct answer, which is why this hid behind a passing test —
// it is a latency bug, not a correctness one, and only a clock catches it.
//
//   enableOfflineQueue:false  -> reject immediately while down instead of queueing
//   commandTimeout            -> cap a command against a connected-but-unresponsive server
//   connectTimeout            -> cap the initial dial
/** Redis is optional. When no REDIS_URL is set (or caching is switched off) there is no
 *  client at all, and every call site degrades to the Postgres path. Typing this as
 *  `Redis | null` rather than hiding the absence behind a stub forces each caller to say
 *  what it does without a cache, which is what keeps "not configured" from being reported
 *  as "down". */
export const redisEnabled = env.REDIS_URL.length > 0 && env.KB_CACHE_TTL_SECONDS > 0;

export const redis = redisEnabled
  ? new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      commandTimeout: 250,
      connectTimeout: 500,
      retryStrategy: (times) => Math.min(times * 200, 5000),
    })
  : null;

redis?.on('error', (err: Error) => {
  console.error('[redis] connection error:', err.message);
});

// lazyConnect keeps startup from blocking on Redis, but with enableOfflineQueue:false a
// command issued before the socket is up is rejected outright rather than waiting for it —
// so the very first cache read (and /healthz) would report Redis down on a cold start even
// when it is perfectly healthy. Kicking off the dial here without awaiting it keeps startup
// non-blocking while ensuring the connection is already in flight by the time anything asks.
void redis?.connect().catch(() => {
  /* the error handler above already logs; retryStrategy owns reconnection from here */
});

/** true = reachable, false = configured but unreachable, null = not configured at all. */
export async function pingRedis(): Promise<boolean | null> {
  if (!redis) return null;
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', env.KB_CACHE_TTL_SECONDS);
  } catch {
    /* fail open — the cache is an optimization, never a correctness dependency */
  }
}

export async function cacheDrop(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    /* fail open */
  }
}
