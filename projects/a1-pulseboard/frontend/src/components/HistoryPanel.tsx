import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../api';

export function HistoryPanel() {
  const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: api.listMetrics });
  const [name, setName] = useState('');

  useEffect(() => {
    if (!name && metrics && metrics.length > 0) setName(metrics[0].name);
  }, [metrics, name]);

  const { data: series } = useQuery({
    queryKey: ['series', name],
    queryFn: () => api.getSeries(name),
    enabled: !!name,
    refetchInterval: 15000,
  });

  if (!metrics || metrics.length === 0)
    return <p className="text-sm text-slate-400">No metrics yet — seed some and run the simulator.</p>;

  const data = (series?.buckets ?? []).map((b) => ({
    t: new Date(b.minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    avg: Math.round(b.avg * 10) / 10,
    max: b.max,
  }));

  return (
    <div className="space-y-4">
      <select
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white cursor-pointer"
      >
        {metrics.map((m) => (
          <option key={m.id} value={m.name}>
            {m.name}
          </option>
        ))}
      </select>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-semibold text-slate-600 mb-2">
          {name} — per-minute average {series?.unit ? `(${series.unit})` : ''}
        </h3>
        {data.length === 0 ? (
          <p className="text-xs text-slate-400">
            No history yet — buckets roll up once a minute of events exists.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="t" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="avg" stroke="#4f46e5" fill="#e0e7ff" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
