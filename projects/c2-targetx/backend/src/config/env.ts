import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4007),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4007'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6386'),
  CORS_ORIGIN: z.string().default('http://localhost:5180'),
  // TTL for the fail-open Redis flag-config cache (0 disables caching).
  CONFIG_CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(300),
  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);
