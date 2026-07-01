export interface Aggregate {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  ratePerSec: number;
}

export interface MetricSnapshot {
  id: string;
  name: string;
  unit: string;
  thresholdType: string;
  thresholdValue: number | null;
  aggregate: Aggregate;
  status: 'ok' | 'warning' | 'critical';
  breach: { level: string; message: string } | null;
}

export interface AlertItem {
  id: string;
  level: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  ts: string;
  resolvedAt: string | null;
  metric: { name: string; unit: string };
}

export interface SeriesPoint {
  minute: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}
export interface Series {
  metric: string;
  unit: string;
  buckets: SeriesPoint[];
}

export interface Metric {
  id: string;
  name: string;
  unit: string;
  description?: string;
  thresholdType: string;
  thresholdValue: number | null;
}

export interface StreamPayload {
  metrics: MetricSnapshot[];
  alerts: AlertItem[];
}
