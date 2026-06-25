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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

export function AnalyticsPanel() {
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval: 5000,
  });

  if (!stats) return <p className="text-sm text-slate-400">Loading…</p>;
  if (stats.totalQueries === 0)
    return (
      <p className="text-sm text-slate-400">
        No questions asked yet — ask something to populate analytics.
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="documents" value={String(stats.documentCount)} />
        <Stat label="chunks" value={String(stats.chunkCount)} />
        <Stat label="answered rate" value={`${Math.round(stats.answeredRate * 100)}%`} />
        <Stat label="cache-hit rate" value={`${Math.round(stats.cacheHitRate * 100)}%`} />
        <Stat label="total questions" value={String(stats.totalQueries)} />
        <Stat label="refused" value={String(stats.refused)} />
        <Stat label="avg latency" value={`${stats.avgLatencyMs} ms`} />
        <Stat label="avg top score" value={stats.avgTopScore.toFixed(3)} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-semibold text-slate-600 mb-2">
          Questions per day (answered vs total)
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={stats.queriesPerDay} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="#94a3b8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="answered" stroke="#4f46e5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-semibold text-slate-600 mb-2">Most-cited documents</h3>
        {stats.topCitedDocuments.length === 0 ? (
          <p className="text-xs text-slate-400">No citations yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={stats.topCitedDocuments}
              margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="title" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="citations" fill="#4f46e5" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
