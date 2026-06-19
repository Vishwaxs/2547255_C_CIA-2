import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4001),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4001'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6380'),
  CORS_ORIGIN: z.string().default('http://localhost:5174'),
  RUN_CONCURRENCY: z.coerce.number().int().positive().default(5),
  RUN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  FLAKINESS_WINDOW: z.coerce.number().int().positive().default(30),
  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);
