import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

// A few demo flags covering the interesting shapes: a boolean flag with a targeting rule,
// a multivariate flag with a fallthrough rollout, and a plan-gated boolean.
const DEMO = [
  {
    key: 'new-onboarding',
    name: 'New onboarding flow',
    variations: [{ key: 'on', value: true }, { key: 'off', value: false }],
    offVariationKey: 'off',
    fallthrough: { variationKey: 'off' },
    rules: [{ conditions: [{ attribute: 'country', op: 'in', values: ['US', 'CA'] }], serve: { variationKey: 'on' } }],
  },
  {
    key: 'pricing-page',
    name: 'Pricing page experiment',
    variations: [{ key: 'control', value: 'A' }, { key: 'variant-b', value: 'B' }, { key: 'variant-c', value: 'C' }],
    offVariationKey: 'control',
    fallthrough: { rollout: [{ variationKey: 'control', weight: 34 }, { variationKey: 'variant-b', weight: 33 }, { variationKey: 'variant-c', weight: 33 }] },
    rules: [],
  },
  {
    key: 'beta-dashboard',
    name: 'Beta dashboard (pro only)',
    variations: [{ key: 'on', value: true }, { key: 'off', value: false }],
    offVariationKey: 'off',
    fallthrough: { variationKey: 'off' },
    rules: [{ conditions: [{ attribute: 'plan', op: 'eq', values: ['pro'] }], serve: { variationKey: 'on' } }],
  },
];

export async function seedFlags(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const d of DEMO) {
    if (await prisma.flag.findUnique({ where: { key: d.key } })) {
      skipped++;
      continue;
    }
    await prisma.flag.create({
      data: {
        key: d.key,
        name: d.name,
        variations: d.variations as Prisma.InputJsonValue,
        fallthrough: d.fallthrough as Prisma.InputJsonValue,
        offVariationKey: d.offVariationKey,
        rules: {
          create: d.rules.map((r, i) => ({
            order: i,
            conditions: r.conditions as Prisma.InputJsonValue,
            serve: r.serve as Prisma.InputJsonValue,
          })),
        },
      },
    });
    created++;
  }
  return { created, skipped };
}
