import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4006),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4006'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6385'),
  CORS_ORIGIN: z.string().default('http://localhost:5179'),

  // Run the dispatcher loop in-process. Disabled in tests so processDue() is driven
  // deterministically (with an explicit `now`) instead of on a timer.
  START_WORKER: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  DISPATCH_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  RETRY_BASE_MS: z.coerce.number().int().positive().default(2000),
  RETRY_CAP_MS: z.coerce.number().int().positive().default(300000),
  DEFAULT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  // Which delivery transport to use. "sink" is offline + deterministic (per-subscription
  // mode); "http" is a real fetch drop-in (no egress in this build).
  TRANSPORT: z.enum(['sink', 'http']).default('sink'),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().nonnegative().default(86400),

  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);
