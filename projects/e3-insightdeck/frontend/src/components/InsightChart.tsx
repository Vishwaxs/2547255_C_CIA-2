import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Insight } from '../types';

const INDIGO = '#4f46e5';
const AMBER = '#d97706';

// Renders an insight's pre-aggregated chartSpec, picking the chart by chartType.
// Outliers and leading categories are highlighted amber.
export function InsightChart({ insight }: { insight: Insight }) {
  const spec = insight.chartSpec;
  const data = spec?.data ?? [];
  const x = spec?.xKey ?? 'x';
  const y = spec?.yKeys?.[0] ?? 'y';
  const margin = { top: 5, right: 12, left: -18, bottom: 0 };

  if (insight.chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={data} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey={x} tick={{ fontSize: 10 }} hide={data.length > 14} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey={y} stroke={INDIGO} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (insight.chartType === 'bar' || insight.chartType === 'histogram') {
    const highlightFirst =
      insight.type === 'top_categories' || insight.type === 'dominant_category';
    const wide = data.length > 6;
    return (
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey={x}
            tick={{ fontSize: 10 }}
            interval={0}
            angle={wide ? -30 : 0}
            textAnchor={wide ? 'end' : 'middle'}
            height={wide ? 48 : 24}
          />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey={y} radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={highlightFirst && i === 0 ? AMBER : INDIGO} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // scatter (correlation, outliers)
  return (
    <ResponsiveContainer width="100%" height={170}>
      <ScatterChart margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey={x} type="number" tick={{ fontSize: 10 }} name={spec?.xLabel} />
        <YAxis dataKey={y} type="number" tick={{ fontSize: 10 }} name={spec?.yLabel} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={data}>
          {data.map((d, i) => (
            <Cell key={i} fill={(d as { outlier?: boolean }).outlier ? AMBER : INDIGO} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
