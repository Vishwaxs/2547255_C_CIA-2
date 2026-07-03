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
