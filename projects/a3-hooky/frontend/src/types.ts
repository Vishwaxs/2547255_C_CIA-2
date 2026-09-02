export interface Subscription {
  id: string;
  name: string;
  endpoint: string;
  eventTypes: string[];
  secret: string;
  mode: string;
  active: boolean;
  maxAttempts: number;
  createdAt: string;
}

export interface DeliveryListItem {
  id: string;
  status: string;
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
  subscription: { name: string; mode: string; endpoint: string };
  event: { type: string };
}

export interface DeliveryAttempt {
  id: string;
  attempt: number;
  statusCode: number | null;
  ok: boolean;
  durationMs: number;
  error: string | null;
  at: string;
}

export interface DeliveryDetail extends Omit<DeliveryListItem, 'event'> {
  attemptLog: DeliveryAttempt[];
  event: { type: string; payload: Record<string, unknown> };
}

export interface Stats {
  subscriptions: number;
  events: number;
  totalDeliveries: number;
  byStatus: { status: string; count: number }[];
  delivered: number;
  dead: number;
  successRate: number;
  avgAttempts: number;
}
