import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4008),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4008'),
  DATABASE_URL: z.string().min(1),
  // Optional. Absent means "no cache configured" — a first-class mode, not an outage:
  // serverless targets have no Redis, and the cache was always fail-open anyway.
  REDIS_URL: z.string().default(''),
  CORS_ORIGIN: z.string().default('http://localhost:5181'),
  // Which Planner implementation drives the loop. Swapping this is the entire difference
  // between the offline deterministic agent and an LLM-backed one.
  PLANNER_KIND: z.enum(['rule_based', 'llm']).default('rule_based'),
  // Hard ceiling on Thought/Action/Observation cycles before the agent force-escalates.
  // The longest legitimate rule-based path is 3 steps; 6 leaves headroom for an LLM
  // planner that wants a retry without ever letting a runaway loop spin forever.
  AGENT_MAX_STEPS: z.coerce.number().int().positive().max(50).default(6),
  // TTL for the fail-open Redis cache of the knowledge base (0 disables caching).
  KB_CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(120),
  // Confidence bar a knowledge-base hit must clear before the agent will answer from it.
  // Below this it escalates instead. See engine/kbSearch.ts for why it takes two numbers.
  KB_MIN_SCORE: z.coerce.number().int().positive().default(4),
  KB_MIN_TERMS: z.coerce.number().int().positive().default(2),
  NODE_ENV: z.string().default('development'),
});

export const env = schema.parse(process.env);
