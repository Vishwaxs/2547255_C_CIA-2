import type {
  TicketListItem,
  TicketDetail,
  KnowledgeArticle,
  Order,
  AgentDescription,
  AgentStats,
  RunResult,
} from './types';

// In dev the API is a separate origin on :4008. In a deployed build the default is the
// SAME origin and requests go to relative paths, which the host's rewrites proxy to the
// API deployment. That keeps the built bundle free of any baked-in backend URL — no
// rebuild to repoint it, and no CORS preflight, because the browser only ever sees one
// origin. VITE_API_URL still overrides both when you want to aim at something else.
const BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:4008' : '');

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
  return (await res.json()) as T;
}

export interface SeedResult {
  articles: number;
  orders: number;
  tickets: number;
  skippedTickets: number;
  ran: number;
}

export interface Health {
  reachable: boolean;
  postgres: boolean;
  /** true = reachable, false = configured but down, 'not_configured' = no cache deployed. */
  redis: boolean | 'not_configured';
}

/** A real dependency probe. /healthz answers 200 or 503 with the same body, so this reads
 *  the body either way instead of throwing — "Redis is down" and "the API is unreachable"
 *  are different facts and the UI needs to tell them apart. */
async function health(): Promise<Health> {
  try {
    const res = await fetch(`${BASE}/healthz`);
    const body = (await res.json().catch(() => ({}))) as {
      postgres?: boolean;
      redis?: boolean | 'not_configured';
    };
    return {
      reachable: true,
      postgres: !!body.postgres,
      redis: body.redis === 'not_configured' ? 'not_configured' : !!body.redis,
    };
  } catch {
    return { reachable: false, postgres: false, redis: false };
  }
}

export const api = {
  health,
  listTickets: (status?: string) =>
    json<TicketListItem[]>(`/api/tickets${status && status !== 'all' ? `?status=${status}` : ''}`),
  getTicket: (id: string) => json<TicketDetail>(`/api/tickets/${id}`),
  createTicket: (data: { customerId: string; subject: string; body: string }) =>
    json<TicketListItem>('/api/tickets', { method: 'POST', body: JSON.stringify(data) }),
  runTicket: (id: string) => json<RunResult>(`/api/tickets/${id}/run`, { method: 'POST' }),
  deleteTicket: (id: string) => json<void>(`/api/tickets/${id}`, { method: 'DELETE' }),
  seed: () => json<SeedResult>('/api/seed', { method: 'POST' }),
  listKb: () => json<KnowledgeArticle[]>('/api/world/kb'),
  listOrders: (customerId?: string) =>
    json<Order[]>(`/api/world/orders${customerId ? `?customerId=${customerId}` : ''}`),
  describeAgent: () => json<AgentDescription>('/api/world/agent'),
  stats: () => json<AgentStats>('/api/world/stats'),
};
