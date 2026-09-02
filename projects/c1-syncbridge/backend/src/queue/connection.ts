import type { ConnectionOptions } from 'bullmq';
import { env } from '../config/env';

// BullMQ requires maxRetriesPerRequest: null. We hand it plain connection
// options (parsed from REDIS_URL) rather than a shared ioredis instance, so it
// constructs and owns its own connections — its recommended setup, and it
// avoids a type clash with BullMQ's bundled copy of ioredis.
export function bullConnection(): ConnectionOptions {
  const u = new URL(env.REDIS_URL);
  return {
    host: u.hostname,
    port: Number(u.port || '6379'),
    username: u.username || undefined,
    password: u.password || undefined,
    maxRetriesPerRequest: null,
  };
}
