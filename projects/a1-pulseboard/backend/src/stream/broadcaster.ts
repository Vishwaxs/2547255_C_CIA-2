import { Response } from 'express';
import { env } from '../config/env';
import { snapshot } from '../services/aggregate.service';
import { reconcileAlerts, recentAlerts } from '../services/alert.service';

// Connected SSE clients. One shared broadcast loop fans a single snapshot out to all of
// them, rather than each connection doing its own work.
const clients = new Set<Response>();
let timer: NodeJS.Timeout | null = null;

export function addClient(res: Response): void {
  clients.add(res);
}
export function removeClient(res: Response): void {
  clients.delete(res);
}
export function clientCount(): number {
  return clients.size;
}

// Build one snapshot payload: aggregates + reconcile alerts + recent alert feed.
export async function tickOnce(): Promise<{ metrics: unknown; alerts: unknown }> {
  const snaps = await snapshot();
  await reconcileAlerts(snaps);
  return { metrics: snaps, alerts: await recentAlerts() };
}

export function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function tick(): Promise<void> {
  if (clients.size === 0) return;
  let payload;
  try {
    payload = await tickOnce();
  } catch {
    return; // never let one bad tick kill the loop
  }
  const frame = sseFrame('snapshot', payload);
  for (const res of clients) res.write(frame);
}

export function startBroadcaster(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), env.SNAPSHOT_MS);
}
export function stopBroadcaster(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
