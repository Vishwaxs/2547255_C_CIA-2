import { Flag, Rule } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { FlagConfig, Variation, Serve } from '../engine/evaluate';
import { Clause } from '../engine/clause';

// Assemble the persisted Flag + its ordered Rules into the pure FlagConfig the engine wants.
export function toConfig(flag: Flag & { rules: Rule[] }): FlagConfig {
  return {
    key: flag.key,
    enabled: flag.enabled,
    variations: flag.variations as unknown as Variation[],
    fallthrough: flag.fallthrough as unknown as Serve,
    offVariationKey: flag.offVariationKey,
    rules: flag.rules
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((r) => ({
        order: r.order,
        conditions: r.conditions as unknown as Clause[],
        serve: r.serve as unknown as Serve,
      })),
  };
}

export async function assembleFlag(key: string): Promise<FlagConfig | null> {
  const flag = await prisma.flag.findUnique({
    where: { key },
    include: { rules: { orderBy: { order: 'asc' } } },
  });
  return flag ? toConfig(flag) : null;
}

export async function assembleAllFlags(): Promise<FlagConfig[]> {
  const flags = await prisma.flag.findMany({ include: { rules: { orderBy: { order: 'asc' } } } });
  return flags.map(toConfig);
}

// ---- fail-open Redis config cache on the evaluation hot path ----
import { redis } from '../lib/redis';
import { env } from '../config/env';

const cacheKey = (key: string): string => `tx:flag:${key}`;

export interface FlagWithConfig {
  id: string;
  config: FlagConfig;
}

// Load a flag's id + assembled config, caching it in Redis (fail-open: a Redis error just
// means a Postgres read). Invalidated explicitly whenever the flag or its rules change, so
// a toggle takes effect immediately.
export async function getFlagWithConfig(key: string): Promise<FlagWithConfig | null> {
  const cached = await redis.get(cacheKey(key)).catch(() => null);
  if (cached) {
    try {
      return JSON.parse(cached) as FlagWithConfig;
    } catch {
      // corrupt entry — recompute
    }
  }
  const flag = await prisma.flag.findUnique({ where: { key }, include: { rules: { orderBy: { order: 'asc' } } } });
  if (!flag) return null;
  const payload: FlagWithConfig = { id: flag.id, config: toConfig(flag) };
  if (env.CONFIG_CACHE_TTL_SECONDS > 0) {
    await redis.set(cacheKey(key), JSON.stringify(payload), 'EX', env.CONFIG_CACHE_TTL_SECONDS).catch(() => undefined);
  }
  return payload;
}

export async function invalidateFlag(key: string): Promise<void> {
  await redis.del(cacheKey(key)).catch(() => undefined);
}
