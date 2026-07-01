import { evaluateThreshold } from '../engine/threshold';
import { Aggregate } from '../engine/window';

const agg = (over: Partial<Aggregate>): Aggregate => ({ count: 1, sum: 0, avg: 0, min: 0, max: 0, ratePerSec: 0, ...over });

describe('evaluateThreshold', () => {
  it('returns null when there is no threshold', () => {
    expect(evaluateThreshold({ name: 'x', unit: '', thresholdType: 'none', thresholdValue: null }, agg({ avg: 999 }))).toBeNull();
  });

  it('flags max_avg breaches', () => {
    const m = { name: 'latency_ms', unit: 'ms', thresholdType: 'max_avg', thresholdValue: 200 };
    expect(evaluateThreshold(m, agg({ avg: 150 }))).toBeNull();
    const b = evaluateThreshold(m, agg({ avg: 240 }));
    expect(b?.level).toBe('warning');
  });

  it('escalates to critical past 1.25x the limit', () => {
    const m = { name: 'cpu', unit: '%', thresholdType: 'max_value', thresholdValue: 80 };
    expect(evaluateThreshold(m, agg({ max: 90 }))?.level).toBe('warning'); // 90 < 100
    expect(evaluateThreshold(m, agg({ max: 105 }))?.level).toBe('critical'); // 105 > 100
  });

  it('flags max_rate breaches', () => {
    const m = { name: 'req', unit: '', thresholdType: 'max_rate', thresholdValue: 5 };
    expect(evaluateThreshold(m, agg({ ratePerSec: 8 }))?.level).toBe('critical');
  });
});
