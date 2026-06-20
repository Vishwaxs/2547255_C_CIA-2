import type {
  Connector,
  ConnectorKind,
  ExternalRecord,
  FlowListItem,
  FlowDetail,
  RunSummary,
  RunDetail,
  CreateFlowInput,
} from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4002';

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
  // connectors
  listConnectors: () => json<Connector[]>('/api/connectors'),
  createConnector: (data: { name: string; kind: ConnectorKind }) =>
    json<Connector>('/api/connectors', { method: 'POST', body: JSON.stringify(data) }),
  seedConnector: (id: string, count: number) =>
    json<{ seeded: number }>(`/api/connectors/${id}/seed`, {
      method: 'POST',
      body: JSON.stringify({ count }),
    }),
  getConnectorRecords: (id: string) =>
    json<ExternalRecord[]>(`/api/connectors/${id}/records`),
  deleteConnector: (id: string) => json<void>(`/api/connectors/${id}`, { method: 'DELETE' }),

  // flows
  listFlows: () => json<FlowListItem[]>('/api/flows'),
  getFlow: (id: string) => json<FlowDetail>(`/api/flows/${id}`),
  createFlow: (data: CreateFlowInput) =>
    json<FlowDetail>('/api/flows', { method: 'POST', body: JSON.stringify(data) }),
  patchFlow: (id: string, data: { enabled?: boolean; conflictStrategy?: string; schedule?: string | null }) =>
    json<FlowDetail>(`/api/flows/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFlow: (id: string) => json<void>(`/api/flows/${id}`, { method: 'DELETE' }),
  getFlowRuns: (id: string) => json<RunSummary[]>(`/api/flows/${id}/runs`),
  triggerFlow: (id: string) =>
    json<{ id: string; status: string }>(`/api/flows/${id}/trigger`, { method: 'POST' }),

  // runs
  getRun: (id: string) => json<RunDetail>(`/api/runs/${id}`),
};
