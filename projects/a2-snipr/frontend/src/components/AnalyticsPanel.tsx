import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { api } from '../api';

interface Props {
  code: string;
}

export function AnalyticsPanel({ code }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['stats', code],
    queryFn: () => api.stats(code),
  });

  if (isLoading) return <p className="text-slate-500">Loading analytics for /{code}…</p>;
  if (isError) return <p className="text-red-600">{(error as Error).message}</p>;
  if (!data) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">
          Analytics · <span className="font-mono text-blue-700">/{data.code}</span>
        </h2>
        <span className="text-sm text-slate-500">{data.totalClicks} total clicks</span>
      </div>

      <h3 className="mb-2 text-sm font-medium text-slate-600">Clicks per day</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.byDay} margin={{ top: 8, right: 16, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" fontSize={12} stroke="#94a3b8" />
            <YAxis allowDecimals={false} fontSize={12} stroke="#94a3b8" />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <BreakdownList title="Top referrers" rows={data.topReferrers.map((r) => ({ label: r.referrer, count: r.count }))} />
        <BreakdownList title="Top countries" rows={data.topCountries.map((r) => ({ label: r.country, count: r.count }))} />
      </div>
    </section>
  );
}

function BreakdownList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-600">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No data yet.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-sm">
              <span className="w-40 truncate text-slate-600" title={r.label}>
                {r.label}
              </span>
              <span className="h-2 rounded bg-blue-200" style={{ width: `${(r.count / max) * 100}%`, minWidth: 4 }} />
              <span className="ml-auto font-medium">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
