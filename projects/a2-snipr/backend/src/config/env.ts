import 'dotenv/config';
import { z } from 'zod';

// All runtime configuration is validated once at startup. If a required value
// is missing or malformed the process fails fast with a clear Zod error rather
// than blowing up deep inside a request handler.
const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  LINK_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  FLUSH_INTERVAL_MS: z.coerce.number().int().positive().default(5000),

  RATE_LIMIT_CREATE_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_CREATE_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_REDIRECT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_REDIRECT_MAX: z.coerce.number().int().positive().default(600),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
