import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4004),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4004'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6383'),
  CORS_ORIGIN: z.string().default('http://localhost:5177'),

  // Which narrator turns computed insights into headlines. "llm" is a stub that throws
  // if selected — no API key in this air-gapped build. The interface is the point.
  NARRATOR_KIND: z.enum(['template', 'llm']).default('template'),

  // Insight-detector tuning (all overridable via env).
  CORRELATION_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  OUTLIER_IQR_FACTOR: z.coerce.number().positive().default(1.5),
  DOMINANT_CATEGORY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.4),
  MISSINGNESS_THRESHOLD: z.coerce.number().min(0).max(1).default(0.2),
  MAX_INSIGHTS: z.coerce.number().int().positive().default(12),

  // Redis deck cache TTL. Fail-open: Redis errors are swallowed.
  DECK_CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(3600),

  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);
