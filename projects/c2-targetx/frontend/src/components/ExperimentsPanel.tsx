import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

export function ExperimentsPanel() {
  const flags = useQuery({ queryKey: ['flags'], queryFn: api.listFlags });
  const [flagKey, setFlagKey] = useState('');
  const effectiveFlag = flagKey || flags.data?.[0]?.key || '';
  const stats = useQuery({
    queryKey: ['stats', effectiveFlag],
    queryFn: () => api.getStats(effectiveFlag),
    enabled: !!effectiveFlag,
  });

  const chartData = stats.data?.byVariation.map((v) => ({ name: v.variationKey, count: v.count, share: v.share })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Experiments</h2>
          <p className="text-sm text-slate-500">Exposure counts per served variation — the live A/B split, logged on every evaluation.</p>
        </div>
        <select value={effectiveFlag} onChange={(e) => setFlagKey(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {flags.data?.map((f) => (
            <option key={f.key} value={f.key}>
              {f.name} ({f.key})
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {!effectiveFlag && <p className="text-sm text-slate-400">No flags yet.</p>}
        {effectiveFlag && stats.data && stats.data.totalExposures === 0 && (
          <p className="text-sm text-slate-400">No exposures yet — evaluate this flag a few times in the Evaluate tab.</p>
        )}
        {stats.data && stats.data.totalExposures > 0 && (
          <>
            <div className="text-sm text-slate-500 mb-4">
              {stats.data.totalExposures} total exposures for <code className="text-slate-700">{stats.data.flag}</code>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, _n, p) => [`${value} (${((p.payload.share as number) * 100).toFixed(1)}%)`, 'exposures']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              {stats.data.byVariation.map((v, i) => (
                <div key={v.variationKey} className="flex items-center gap-3 text-sm">
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="font-medium text-slate-700">{v.variationKey}</span>
                  <span className="ml-auto text-slate-500">
                    {v.count} · {(v.share * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>

            {stats.data.byReason.length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">By reason</div>
                <div className="flex flex-wrap gap-2">
                  {stats.data.byReason.map((r) => (
                    <span key={r.reason} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs">
                      {r.reason}: <strong>{r.count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
