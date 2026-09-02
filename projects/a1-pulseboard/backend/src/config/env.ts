import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4005),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4005'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6384'),
  CORS_ORIGIN: z.string().default('http://localhost:5178'),

  // Run the SSE broadcaster + rollup job in-process. Disabled in tests so the pure
  // engine is exercised directly without background intervals.
  START_STREAM: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  WINDOW_MS: z.coerce.number().int().positive().default(60000),
  SNAPSHOT_MS: z.coerce.number().int().positive().default(1000),
  ROLLUP_MS: z.coerce.number().int().positive().default(60000),
  SIMULATOR_RATE: z.coerce.number().int().positive().default(5),

  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);
