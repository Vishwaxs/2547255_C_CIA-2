import { Frame, ColumnView } from './frame';
import { RawInsight } from '../ai/narrator';
import { mean, median, pearson, iqrBounds, linearTrend, skewness, min, max } from './stats';

export interface DetectorConfig {
  correlationThreshold: number;
  outlierIqrFactor: number;
  dominantThreshold: number; // share of rows
  missingnessThreshold: number; // null rate
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const nums = (c: ColumnView): number[] => c.values.filter((v): v is number => typeof v === 'number');

// --- trend: a numeric measure aggregated over the first datetime column --------------
export function detectTrend(frame: Frame): RawInsight[] {
  const dateCol = frame.datetime[0];
  if (!dateCol || frame.numeric.length === 0) return [];
  const out: RawInsight[] = [];
  for (const measure of frame.numeric) {
    // sum the measure per distinct day, sorted ascending
    const byDay = new Map<string, number>();
    for (let i = 0; i < frame.rowCount; i++) {
      const d = dateCol.values[i];
      const m = measure.values[i];
      if (!(d instanceof Date) || typeof m !== 'number') continue;
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + m);
    }
    const series = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (series.length < 3) continue;
    const ys = series.map((s) => s[1]);
    const xs = ys.map((_, i) => i);
    const { slope } = linearTrend(xs, ys);
    const first = ys[0];
    const last = ys[ys.length - 1];
    if (first === 0) continue;
    const pctChange = ((last - first) / Math.abs(first)) * 100;
    if (Math.abs(pctChange) < 5) continue;
    out.push({
      type: 'trend',
      score: clamp01(Math.abs(pctChange) / 200),
      chartType: 'line',
      chartSpec: {
        data: series.map(([x, y]) => ({ x, y })),
        xKey: 'x',
        yKeys: ['y'],
        yLabel: measure.name,
      },
      detail: {
        measure: measure.name,
        start: series[0][0],
        end: series[series.length - 1][0],
        pctChange,
        slope,
      },
      columns: [dateCol.name, measure.name],
    });
  }
  return out;
}

// --- top_categories: a measure summed by a categorical dimension ---------------------
export function detectTopCategories(frame: Frame): RawInsight[] {
  const measure = frame.numeric[0];
  if (!measure) return [];
  const out: RawInsight[] = [];
  for (const dim of frame.categorical) {
    const sums = new Map<string, number>();
    for (let i = 0; i < frame.rowCount; i++) {
      const cat = dim.values[i];
      const m = measure.values[i];
      if (typeof cat !== 'string' || typeof m !== 'number') continue;
      sums.set(cat, (sums.get(cat) ?? 0) + m);
    }
    const total = [...sums.values()].reduce((a, b) => a + b, 0);
    if (sums.size < 2 || total <= 0) continue;
    const ranked = [...sums.entries()].sort((a, b) => b[1] - a[1]);
    const topShare = (ranked[0][1] / total) * 100;
    out.push({
      type: 'top_categories',
      score: clamp01(topShare / 100),
      chartType: 'bar',
      chartSpec: {
        data: ranked.slice(0, 8).map(([label, value]) => ({ label, value })),
        xKey: 'label',
        yKeys: ['value'],
        yLabel: measure.name,
      },
      detail: {
        dimension: dim.name,
        measure: measure.name,
        topCategory: ranked[0][0],
        topShare,
        top: ranked.slice(0, 5).map(([category, value]) => ({ category, value })),
      },
      columns: [dim.name, measure.name],
    });
  }
  return out;
}

// --- outliers: IQR-rule outliers in a numeric column ---------------------------------
export function detectOutliers(frame: Frame, cfg: DetectorConfig): RawInsight[] {
  const out: RawInsight[] = [];
  for (const col of frame.numeric) {
    const xs = nums(col);
    if (xs.length < 4) continue;
    const b = iqrBounds(xs, cfg.outlierIqrFactor);
    if (b.iqr === 0) continue;
    const med = median(xs);
    const outliers = xs.filter((v) => v < b.lower || v > b.upper);
    if (outliers.length === 0) continue;
    const extreme = outliers.reduce((a, v) => (Math.abs(v - med) > Math.abs(a - med) ? v : a), outliers[0]);
    out.push({
      type: 'outliers',
      score: clamp01(0.35 + outliers.length / xs.length),
      chartType: 'scatter',
      chartSpec: {
        data: col.values.map((v, i) => ({ x: i, y: typeof v === 'number' ? v : null, outlier: typeof v === 'number' && (v < b.lower || v > b.upper) })),
        xKey: 'x',
        yKeys: ['y'],
        yLabel: col.name,
      },
      detail: {
        column: col.name,
        count: outliers.length,
        maxValue: extreme,
        multipleOfMedian: med !== 0 ? extreme / med : 0,
        lower: b.lower,
        upper: b.upper,
      },
      columns: [col.name],
    });
  }
  return out;
}

// --- correlation: strong Pearson correlation between two numeric columns -------------
export function detectCorrelation(frame: Frame, cfg: DetectorConfig): RawInsight[] {
  const cols = frame.numeric;
  const found: { x: ColumnView; y: ColumnView; r: number }[] = [];
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let k = 0; k < frame.rowCount; k++) {
        const a = cols[i].values[k];
        const b = cols[j].values[k];
        if (typeof a === 'number' && typeof b === 'number') {
          xs.push(a);
          ys.push(b);
        }
      }
      const r = pearson(xs, ys);
      if (Math.abs(r) >= cfg.correlationThreshold) found.push({ x: cols[i], y: cols[j], r });
    }
  }
  found.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return found.slice(0, 3).map(({ x, y, r }) => ({
    type: 'correlation',
    score: clamp01(Math.abs(r)),
    chartType: 'scatter' as const,
    chartSpec: {
      data: x.values
        .map((v, k) => ({ x: v, y: y.values[k] }))
        .filter((p) => typeof p.x === 'number' && typeof p.y === 'number'),
      xKey: 'x',
      yKeys: ['y'],
      xLabel: x.name,
      yLabel: y.name,
    },
    detail: { columnX: x.name, columnY: y.name, r },
    columns: [x.name, y.name],
  }));
}

// --- distribution: notable skew in a numeric column ----------------------------------
export function detectDistribution(frame: Frame): RawInsight[] {
  const out: RawInsight[] = [];
  for (const col of frame.numeric) {
    const xs = nums(col);
    if (xs.length < 8) continue;
    const skew = skewness(xs);
    if (Math.abs(skew) < 0.5) continue;
    const lo = min(xs);
    const hi = max(xs);
    const binCount = 10;
    const width = (hi - lo) / binCount || 1;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      bin: `${Math.round(lo + i * width)}`,
      count: 0,
    }));
    for (const v of xs) {
      const idx = Math.min(binCount - 1, Math.floor((v - lo) / width));
      bins[idx].count++;
    }
    out.push({
      type: 'distribution',
      score: clamp01(Math.abs(skew) / 2),
      chartType: 'histogram',
      chartSpec: { data: bins, xKey: 'bin', yKeys: ['count'], yLabel: col.name },
      detail: { column: col.name, skew },
      columns: [col.name],
    });
  }
  return out;
}

// --- dominant_category: one value covers most of a categorical column's rows ---------
export function detectDominantCategory(frame: Frame, cfg: DetectorConfig): RawInsight[] {
  const out: RawInsight[] = [];
  for (const col of frame.categorical) {
    const counts = new Map<string, number>();
    let n = 0;
    for (const v of col.values) {
      if (typeof v !== 'string') continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
      n++;
    }
    if (n === 0) continue;
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const share = (ranked[0][1] / n) * 100;
    if (share < cfg.dominantThreshold * 100) continue;
    out.push({
      type: 'dominant_category',
      score: clamp01(share / 100),
      chartType: 'bar',
      chartSpec: {
        data: ranked.slice(0, 8).map(([label, value]) => ({ label, value })),
        xKey: 'label',
        yKeys: ['value'],
        yLabel: 'rows',
      },
      detail: { column: col.name, value: ranked[0][0], share },
      columns: [col.name],
    });
  }
  return out;
}

// --- missingness: columns with a high null rate --------------------------------------
export function detectMissingness(frame: Frame, cfg: DetectorConfig): RawInsight[] {
  if (frame.rowCount === 0) return [];
  const rates = frame.columns.map((c) => ({
    name: c.name,
    rate: (c.raw.filter((v) => v.trim() === '').length / frame.rowCount) * 100,
  }));
  const offending = rates.filter((r) => r.rate >= cfg.missingnessThreshold * 100);
  if (offending.length === 0) return [];
  const worst = [...offending].sort((a, b) => b.rate - a.rate)[0];
  return [
    {
      type: 'missingness',
      score: clamp01(worst.rate / 100),
      chartType: 'bar',
      chartSpec: {
        data: rates.map((r) => ({ label: r.name, value: Math.round(r.rate * 10) / 10 })),
        xKey: 'label',
        yKeys: ['value'],
        yLabel: '% empty',
      },
      detail: { column: worst.name, rate: worst.rate, columns: offending },
      columns: offending.map((o) => o.name),
    },
  ];
}

// --- segment_vs_average: a category whose mean measure deviates most from overall -----
export function detectSegmentVsAverage(frame: Frame): RawInsight[] {
  const measure = frame.numeric[0];
  if (!measure) return [];
  const overall = mean(nums(measure));
  if (overall === 0) return [];
  const out: RawInsight[] = [];
  for (const dim of frame.categorical) {
    const groups = new Map<string, number[]>();
    for (let i = 0; i < frame.rowCount; i++) {
      const cat = dim.values[i];
      const m = measure.values[i];
      if (typeof cat !== 'string' || typeof m !== 'number') continue;
      (groups.get(cat) ?? groups.set(cat, []).get(cat)!).push(m);
    }
    if (groups.size < 2) continue;
    const avgs = [...groups.entries()].map(([cat, vals]) => ({ cat, avg: mean(vals) }));
    const worst = avgs
      .map((a) => ({ ...a, pctDiff: ((a.avg - overall) / Math.abs(overall)) * 100 }))
      .sort((a, b) => Math.abs(b.pctDiff) - Math.abs(a.pctDiff))[0];
    if (Math.abs(worst.pctDiff) < 10) continue;
    out.push({
      type: 'segment_vs_average',
      score: clamp01(Math.abs(worst.pctDiff) / 100),
      chartType: 'bar',
      chartSpec: {
        data: avgs.map((a) => ({ label: a.cat, value: Math.round(a.avg * 100) / 100 })),
        xKey: 'label',
        yKeys: ['value'],
        yLabel: `avg ${measure.name}`,
      },
      detail: {
        dimension: dim.name,
        measure: measure.name,
        segment: worst.cat,
        segmentAvg: worst.avg,
        overallAvg: overall,
        pctDiff: worst.pctDiff,
      },
      columns: [dim.name, measure.name],
    });
  }
  return out;
}

// Run every detector and collect all insights (deck service sorts + caps + narrates).
export function runDetectors(frame: Frame, cfg: DetectorConfig): RawInsight[] {
  return [
    ...detectTrend(frame),
    ...detectTopCategories(frame),
    ...detectCorrelation(frame, cfg),
    ...detectSegmentVsAverage(frame),
    ...detectDominantCategory(frame, cfg),
    ...detectOutliers(frame, cfg),
    ...detectDistribution(frame),
    ...detectMissingness(frame, cfg),
  ];
}
