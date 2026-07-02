import type { Subscription, DeliveryListItem, DeliveryDetail, Stats } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4006';

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
  listDeliveries: (status?: string) =>
    json<DeliveryListItem[]>(`/api/deliveries${status ? `?status=${status}` : ''}`),
  getDelivery: (id: string) => json<DeliveryDetail>(`/api/deliveries/${id}`),
  replayDelivery: (id: string) => json<unknown>(`/api/deliveries/${id}/replay`, { method: 'POST' }),

  publishEvent: (data: { type: string; payload: Record<string, unknown> }) =>
    json<{ eventId: string; deliveries: number; deduped: boolean }>('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listSubscriptions: () => json<Subscription[]>('/api/subscriptions'),
  seedSubscriptions: () => json<{ created: number; skipped: number }>('/api/subscriptions/seed', { method: 'POST' }),
  createSubscription: (data: {
    name: string;
    endpoint: string;
    eventTypes: string[];
    mode: string;
  }) => json<Subscription>('/api/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  patchSubscription: (id: string, data: { active?: boolean }) =>
    json<Subscription>(`/api/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSubscription: (id: string) => json<void>(`/api/subscriptions/${id}`, { method: 'DELETE' }),

  getStats: () => json<Stats>('/api/stats'),
};

export const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  delivering: 'bg-sky-100 text-sky-700',
  retrying: 'bg-amber-100 text-amber-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  dead: 'bg-rose-100 text-rose-700',
};
