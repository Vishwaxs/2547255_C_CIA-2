import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4002),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4002'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6381'),
  CORS_ORIGIN: z.string().default('http://localhost:5175'),
  SYNC_CONCURRENCY: z.coerce.number().int().positive().default(5),
  // Start the BullMQ worker in-process. Disabled in tests so the engine is
  // exercised directly without a Redis dependency.
  START_WORKER: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);
