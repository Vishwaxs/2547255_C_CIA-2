import { ColumnType, coerce, isBlank, toNumber, toDate } from './infer';
import { mean, median, stddev, quantile, min, max } from './stats';

export interface ColumnProfile {
  nullCount: number;
  distinctCount: number;
  stats: Record<string, unknown>;
}

// Profile one column from its raw string values + inferred type. The per-type `stats`
// blob feeds both the UI column drawer and the insight detectors.
export function profileColumn(values: string[], type: ColumnType): ColumnProfile {
  const nullCount = values.filter(isBlank).length;
  const nonBlank = values.filter((v) => !isBlank(v));
  const distinctCount = new Set(nonBlank).size;

  let stats: Record<string, unknown> = {};
  if (type === 'numeric') {
    const nums = nonBlank.map(toNumber).filter((n): n is number => n !== null);
    stats = nums.length
      ? {
          min: min(nums),
          max: max(nums),
          mean: mean(nums),
          median: median(nums),
          stddev: stddev(nums),
          q1: quantile(nums, 0.25),
          q3: quantile(nums, 0.75),
        }
      : {};
  } else if (type === 'datetime') {
    const times = nonBlank.map(toDate).filter((d): d is Date => d !== null).map((d) => d.getTime());
    stats = times.length
      ? { min: new Date(min(times)).toISOString(), max: new Date(max(times)).toISOString(), count: times.length }
      : {};
  } else if (type === 'boolean') {
    let t = 0;
    let f = 0;
    for (const v of nonBlank) {
      const b = coerce(v, 'boolean');
      if (b === true) t++;
      else if (b === false) f++;
    }
    stats = { trueCount: t, falseCount: f };
  } else {
    // categorical / text: top values by frequency
    const counts = new Map<string, number>();
    for (const v of nonBlank) counts.set(v, (counts.get(v) ?? 0) + 1);
    const topValues = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));
    stats = { topValues };
  }

  return { nullCount, distinctCount, stats };
}
