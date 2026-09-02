import { prisma } from '../lib/prisma';

// Default demo metrics, so a fresh clone has something to watch immediately. Thresholds
// are chosen so the simulator's occasional spikes trip alerts.
export const DEFAULT_METRICS = [
  { name: 'requests', unit: '', description: 'incoming requests', thresholdType: 'none', thresholdValue: null },
  { name: 'latency_ms', unit: 'ms', description: 'response latency', thresholdType: 'max_avg', thresholdValue: 200 },
  { name: 'error_rate', unit: '%', description: 'error percentage', thresholdType: 'max_avg', thresholdValue: 5 },
  { name: 'cpu', unit: '%', description: 'CPU utilisation', thresholdType: 'max_value', thresholdValue: 90 },
] as const;

export async function seedMetrics(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const m of DEFAULT_METRICS) {
    const existing = await prisma.metric.findUnique({ where: { name: m.name } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.metric.create({
      data: {
        name: m.name,
        unit: m.unit,
        description: m.description,
        thresholdType: m.thresholdType,
        thresholdValue: m.thresholdValue,
      },
    });
    created++;
  }
  return { created, skipped };
}
