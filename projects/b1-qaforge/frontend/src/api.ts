import type { SuiteListItem, Suite, RunDetail, SuiteStats, RunSummary } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4001';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listSuites: () => json<SuiteListItem[]>('/api/suites'),
  getSuite: (id: string) => json<Suite>(`/api/suites/${id}`),
  createSuite: (data: {
    name: string;
    baseUrl: string;
    description?: string;
    timeoutMs?: number;
  }) => json<Suite>('/api/suites', { method: 'POST', body: JSON.stringify(data) }),

  listRuns: (suiteId: string) => json<RunSummary[]>(`/api/runs?suiteId=${suiteId}`),
  getRun: (id: string) => json<RunDetail>(`/api/runs/${id}`),
  triggerRun: (suiteId: string) =>
    json<{ id: string; status: string }>('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ suiteId }),
    }),

  getStats: (suiteId: string) => json<SuiteStats>(`/api/suites/${suiteId}/stats`),
};
