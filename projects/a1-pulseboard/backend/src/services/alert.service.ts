import { Alert } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { MetricSnapshot } from './aggregate.service';

// Edge-triggered alerting: open exactly one alert when a metric enters breach, and resolve
// it when the metric recovers — so a sustained breach produces one alert, not one per tick.
export async function reconcileAlerts(snaps: MetricSnapshot[]): Promise<Alert[]> {
  const fired: Alert[] = [];
  for (const s of snaps) {
    const open = await prisma.alert.findFirst({
      where: { metricId: s.id, resolvedAt: null },
      orderBy: { ts: 'desc' },
    });
    if (s.breach) {
      if (!open) {
        fired.push(
          await prisma.alert.create({
            data: {
              metricId: s.id,
              level: s.breach.level,
              message: s.breach.message,
              value: s.breach.value,
              threshold: s.breach.threshold,
            },
          }),
        );
      }
    } else if (open) {
      await prisma.alert.update({ where: { id: open.id }, data: { resolvedAt: new Date() } });
    }
  }
  return fired;
}

export async function recentAlerts(limit = 20): Promise<unknown[]> {
  return prisma.alert.findMany({
    orderBy: { ts: 'desc' },
    take: limit,
    include: { metric: { select: { name: true, unit: true } } },
  });
}
