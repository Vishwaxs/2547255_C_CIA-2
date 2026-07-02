import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api';

const COLORS: Record<string, string> = {
  pending: '#94a3b8',
  delivering: '#0ea5e9',
  retrying: '#d97706',
  delivered: '#10b981',
  dead: '#e11d48',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

export function AnalyticsPanel() {
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.getStats, refetchInterval: 3000 });
  if (!stats) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="subscriptions" value={String(stats.subscriptions)} />
        <Stat label="events" value={String(stats.events)} />
        <Stat label="deliveries" value={String(stats.totalDeliveries)} />
        <Stat label="success rate" value={`${Math.round(stats.successRate * 100)}%`} />
        <Stat label="delivered" value={String(stats.delivered)} />
        <Stat label="dead-lettered" value={String(stats.dead)} />
        <Stat label="avg attempts" value={stats.avgAttempts.toFixed(2)} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-semibold text-slate-600 mb-2">Deliveries by status</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={stats.byStatus} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="status" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {stats.byStatus.map((s) => (
                <Cell key={s.status} fill={COLORS[s.status] ?? '#4f46e5'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
