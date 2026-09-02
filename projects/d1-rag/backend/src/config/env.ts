import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4003),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4003'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6382'),
  CORS_ORIGIN: z.string().default('http://localhost:5176'),

  // Which AI implementations to use. The real ones (openai/claude) are stubs that
  // throw if selected — there are no API keys in this air-gapped build. The whole
  // point of the interface is that swapping them in needs no engine change.
  EMBEDDER_KIND: z.enum(['tfidf', 'hashing', 'openai']).default('tfidf'),
  GENERATOR_KIND: z.enum(['extractive', 'claude']).default('extractive'),
  // Fixed vector size for the hashing embedder (tfidf sizes to the corpus vocabulary).
  EMBEDDING_DIM: z.coerce.number().int().positive().default(256),

  // Retrieval defaults (a request may override topK / threshold).
  RETRIEVAL_TOP_K: z.coerce.number().int().positive().default(5),
  RETRIEVAL_THRESHOLD: z.coerce.number().min(0).max(1).default(0.05),

  // Redis answer-cache TTL. The cache is fail-open: Redis errors are swallowed.
  ANSWER_CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(3600),

  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);
