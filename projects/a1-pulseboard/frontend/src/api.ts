import type { MetricSnapshot, AlertItem, Series, Metric } from './types';

export const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4005';
export const STREAM_URL = `${BASE}/api/stream`;

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listMetrics: () => json<MetricSnapshot[]>('/api/metrics'),
  seedMetrics: () => json<{ created: number; skipped: number }>('/api/metrics/seed', { method: 'POST' }),
  createMetric: (data: {
    name: string;
    unit: string;
    thresholdType: string;
    thresholdValue: number | null;
  }) => json<Metric>('/api/metrics', { method: 'POST', body: JSON.stringify(data) }),
  getSeries: (name: string) => json<Series>(`/api/metrics/${encodeURIComponent(name)}/series`),
  listAlerts: () => json<AlertItem[]>('/api/alerts'),

  getSimulator: () => json<{ running: boolean }>('/api/simulator'),
  startSimulator: () => json<{ running: boolean }>('/api/simulator/start', { method: 'POST' }),
  stopSimulator: () => json<{ running: boolean }>('/api/simulator/stop', { method: 'POST' }),
};
