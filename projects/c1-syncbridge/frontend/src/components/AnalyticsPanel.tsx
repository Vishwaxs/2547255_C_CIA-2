import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { api } from '../api';

export function AnalyticsPanel({ flowId }: { flowId: string }) {
  const { data: runs } = useQuery({
    queryKey: ['flow-runs', flowId],
    queryFn: () => api.getFlowRuns(flowId),
    refetchInterval: 5000,
  });

  if (!runs) return <p className="text-xs text-slate-400">Loading…</p>;
  if (runs.length === 0)
    return <p className="text-xs text-slate-400">No runs yet — trigger a sync to see analytics.</p>;

  // Oldest → newest for a left-to-right time series.
  const series = [...runs]
    .reverse()
    .map((r, i) => ({
      label: `#${i + 1}`,
      upserted: r.recordsUpserted,
      skipped: r.recordsSkipped,
      conflicts: r.recordsConflicted,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold text-slate-600 mb-2">Records upserted vs skipped per run</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="upserted" stroke="#4f46e5" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="skipped" stroke="#94a3b8" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-600 mb-2">Conflicts resolved per run</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="conflicts" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
