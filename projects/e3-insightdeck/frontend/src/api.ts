import type { DatasetListItem, DatasetDetail, Deck, Stats } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4004';

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
  listDatasets: () => json<DatasetListItem[]>('/api/datasets'),
  getDataset: (id: string) => json<DatasetDetail>(`/api/datasets/${id}`),
  createDataset: (data: { name: string; csv: string }) =>
    json<{ dataset: DatasetListItem; created: boolean }>('/api/datasets', {
      method: 'POST',
      body: JSON.stringify({ ...data, source: 'paste' }),
    }),
  deleteDataset: (id: string) => json<void>(`/api/datasets/${id}`, { method: 'DELETE' }),
  seedDataset: () => json<{ dataset: DatasetListItem; created: boolean }>('/api/datasets/seed', { method: 'POST' }),

  generateDeck: (datasetId: string) =>
    json<Deck>(`/api/datasets/${datasetId}/generate`, { method: 'POST' }),
  getLatestDeck: (datasetId: string) => json<Deck>(`/api/datasets/${datasetId}/deck`),

  getStats: () => json<Stats>('/api/stats'),
};
