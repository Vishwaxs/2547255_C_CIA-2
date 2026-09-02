import type {
  DocumentListItem,
  DocumentDetail,
  QueryResult,
  QueryListItem,
  QueryDetailData,
  Stats,
} from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4003';

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
  // documents
  listDocuments: () => json<DocumentListItem[]>('/api/documents'),
  getDocument: (id: string) => json<DocumentDetail>(`/api/documents/${id}`),
  createDocument: (data: { title: string; text: string }) =>
    json<{ document: DocumentListItem; created: boolean }>('/api/documents', {
      method: 'POST',
      body: JSON.stringify({ ...data, source: 'paste' }),
    }),
  deleteDocument: (id: string) => json<void>(`/api/documents/${id}`, { method: 'DELETE' }),
  seedDocuments: () =>
    json<{ created: number; skipped: number }>('/api/documents/seed', { method: 'POST' }),

  // query
  ask: (data: { question: string; topK?: number; threshold?: number }) =>
    json<QueryResult>('/api/query', { method: 'POST', body: JSON.stringify(data) }),

  // history
  listQueries: () => json<QueryListItem[]>('/api/queries'),
  getQuery: (id: string) => json<QueryDetailData>(`/api/queries/${id}`),

  // stats
  getStats: () => json<Stats>('/api/stats'),
};
