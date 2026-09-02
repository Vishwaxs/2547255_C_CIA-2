import { Prisma, Subscription } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { generateSecret } from '../engine/sign';

// Active subscriptions whose event-type list matches (or is a wildcard for) this event.
export async function matchingSubscriptions(eventType: string): Promise<Subscription[]> {
  const subs = await prisma.subscription.findMany({ where: { active: true } });
  return subs.filter((s) => {
    const types = (s.eventTypes as string[]) ?? [];
    return types.includes('*') || types.includes(eventType);
  });
}

const DEMO_SUBS = [
  { name: 'Reliable endpoint', mode: 'ok' },
  { name: 'Flaky endpoint', mode: 'flaky' },
  { name: 'Broken endpoint', mode: 'fail' },
  { name: 'Slow endpoint', mode: 'slow' },
];

// Seed one subscription per sink mode so the delivery behaviours are all demonstrable.
export async function seedSubscriptions(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const d of DEMO_SUBS) {
    const existing = await prisma.subscription.findFirst({ where: { name: d.name } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.subscription.create({
      data: {
        name: d.name,
        endpoint: `https://sink.local/${d.mode}`,
        eventTypes: ['*'] as Prisma.InputJsonValue,
        secret: generateSecret(),
        mode: d.mode,
        maxAttempts: env.DEFAULT_MAX_ATTEMPTS,
      },
    });
    created++;
  }
  return { created, skipped };
}
