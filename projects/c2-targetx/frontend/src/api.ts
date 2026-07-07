import type { FlagListItem, FlagDetail, EvalResult, Stats, Condition, Serve } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4007';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listFlags: () => json<FlagListItem[]>('/api/flags'),
  getFlag: (key: string) => json<FlagDetail>(`/api/flags/${key}`),
  createFlag: (data: unknown) => json<FlagListItem>('/api/flags', { method: 'POST', body: JSON.stringify(data) }),
  patchFlag: (key: string, data: { enabled?: boolean }) => json<FlagListItem>(`/api/flags/${key}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFlag: (key: string) => json<void>(`/api/flags/${key}`, { method: 'DELETE' }),
  seedFlags: () => json<{ created: number; skipped: number }>('/api/flags/seed', { method: 'POST' }),

  addRule: (key: string, data: { conditions: Condition[]; serve: Serve }) =>
    json<unknown>(`/api/flags/${key}/rules`, { method: 'POST', body: JSON.stringify(data) }),
  deleteRule: (key: string, ruleId: string) => json<void>(`/api/flags/${key}/rules/${ruleId}`, { method: 'DELETE' }),

  evaluate: (key: string, ctx: { unitKey: string; attributes: Record<string, unknown> }) =>
    json<EvalResult>(`/api/flags/${key}/evaluate`, { method: 'POST', body: JSON.stringify(ctx) }),
  evaluateAll: (ctx: { unitKey: string; attributes: Record<string, unknown> }) =>
    json<{ unitKey: string; flags: Record<string, { variationKey: string; value: unknown; reason: string }> }>('/api/evaluate', { method: 'POST', body: JSON.stringify(ctx) }),

  getStats: (key: string) => json<Stats>(`/api/flags/${key}/stats`),
};
