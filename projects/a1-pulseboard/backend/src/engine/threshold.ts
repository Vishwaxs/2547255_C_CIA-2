import { Aggregate } from './window';

export interface MetricThreshold {
  name: string;
  unit: string;
  thresholdType: string; // none | max_avg | max_value | max_rate
  thresholdValue: number | null;
}

export interface Breach {
  level: 'warning' | 'critical';
  message: string;
  value: number; // the observed value that breached
  threshold: number;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// Evaluate a metric's threshold against its current aggregate. Returns null when there's
// no threshold or it isn't breached. A breach is `critical` past 1.25× the limit, else
// `warning`. Pure — the persisting of Alert rows happens in the aggregate service.
export function evaluateThreshold(metric: MetricThreshold, agg: Aggregate): Breach | null {
  if (metric.thresholdType === 'none' || metric.thresholdValue == null) return null;

  let observed: number;
  let label: string;
  switch (metric.thresholdType) {
    case 'max_avg':
      observed = agg.avg;
      label = 'avg';
      break;
    case 'max_value':
      observed = agg.max;
      label = 'max';
      break;
    case 'max_rate':
      observed = agg.ratePerSec;
      label = 'rate';
      break;
    default:
      return null;
  }
  if (observed <= metric.thresholdValue) return null;

  const level = observed > metric.thresholdValue * 1.25 ? 'critical' : 'warning';
  const message = `${metric.name} ${label} ${round(observed)}${metric.unit} exceeds ${metric.thresholdValue}${metric.unit}`;
  return { level, message, value: observed, threshold: metric.thresholdValue };
}
