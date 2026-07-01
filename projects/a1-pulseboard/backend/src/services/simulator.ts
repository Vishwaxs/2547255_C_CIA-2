import { env } from '../config/env';
import { ingestEvent } from './ingest.service';

// A built-in event generator so the dashboard "pulses" with zero external traffic — the
// air-gap-friendly way to demo a real-time system. Each tick emits one sample per demo
// metric, with occasional spikes tuned to trip the seeded thresholds (so alerts fire live).
interface SimMetric {
  name: string;
  base: number;
  jitter: number;
  spikeChance: number;
  spikeTo: number;
}

const SIM_METRICS: SimMetric[] = [
  { name: 'requests', base: 25, jitter: 15, spikeChance: 0, spikeTo: 0 },
  { name: 'latency_ms', base: 120, jitter: 55, spikeChance: 0.08, spikeTo: 340 }, // trips max_avg 200
  { name: 'error_rate', base: 1.5, jitter: 2, spikeChance: 0.06, spikeTo: 9 }, // trips max_avg 5
  { name: 'cpu', base: 55, jitter: 22, spikeChance: 0.05, spikeTo: 97 }, // trips max_value 90
];

let timer: NodeJS.Timeout | null = null;

function nextValue(m: SimMetric): number {
  if (m.spikeChance > 0 && Math.random() < m.spikeChance) {
    return Math.round((m.spikeTo + Math.random() * 5) * 10) / 10;
  }
  const v = m.base + (Math.random() * 2 - 1) * m.jitter;
  return Math.max(0, Math.round(v * 10) / 10);
}

async function tick(): Promise<void> {
  await Promise.all(
    SIM_METRICS.map((m) => ingestEvent({ metric: m.name, value: nextValue(m) }).catch(() => undefined)),
  );
}

export function startSimulator(): void {
  if (timer) return;
  const intervalMs = Math.max(50, Math.round(1000 / env.SIMULATOR_RATE));
  timer = setInterval(() => void tick(), intervalMs);
}
export function stopSimulator(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
export function simulatorRunning(): boolean {
  return timer !== null;
}
