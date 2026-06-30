import { Narrator, RawInsight } from './narrator';

function num(v: unknown, digits = 0): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

// Deterministic, offline narrator: one template per insight type, filled from the
// detector's `detail`. Plain English, no model, no network — the default headline writer.
export class TemplateNarrator implements Narrator {
  readonly kind = 'template';

  narrate(insight: RawInsight): string {
    const d = insight.detail;
    switch (insight.type) {
      case 'trend': {
        const dir = Number(d.pctChange) >= 0 ? 'rose' : 'fell';
        return `${d.measure} ${dir} ${num(Math.abs(Number(d.pctChange)), 1)}% from ${d.start} to ${d.end}`;
      }
      case 'top_categories':
        return `${d.topCategory} leads ${d.dimension} with ${num(d.topShare, 1)}% of total ${d.measure}`;
      case 'outliers':
        return `${d.column} has ${d.count} outlier${Number(d.count) === 1 ? '' : 's'} — the highest, ${num(d.maxValue)}, is ${num(d.multipleOfMedian, 1)}× the median`;
      case 'correlation': {
        const strength = Math.abs(Number(d.r)) >= 0.8 ? 'strongly' : 'moderately';
        const dir = Number(d.r) >= 0 ? 'positively' : 'negatively';
        return `${d.columnX} and ${d.columnY} are ${strength} ${dir} correlated (r = ${num(d.r, 2)})`;
      }
      case 'distribution': {
        const dir = Number(d.skew) >= 0 ? 'right' : 'left';
        return `${d.column} is ${dir}-skewed (skew ${num(d.skew, 2)})`;
      }
      case 'dominant_category':
        return `${d.value} dominates ${d.column} at ${num(d.share, 1)}% of rows`;
      case 'missingness':
        return `${d.column} is ${num(d.rate, 1)}% empty`;
      case 'segment_vs_average': {
        const ab = Number(d.pctDiff) >= 0 ? 'above' : 'below';
        return `${d.segment}'s average ${d.measure} is ${num(Math.abs(Number(d.pctDiff)), 1)}% ${ab} the overall average`;
      }
      default:
        return `Insight (${insight.type})`;
    }
  }
}
