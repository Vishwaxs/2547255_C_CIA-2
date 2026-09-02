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
import type { CaseStat } from '../types';

function FlakinessBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const colour = pct === 0 ? 'bg-green-400' : pct < 30 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-600 w-8 text-right">{pct}%</span>
    </div>
  );
}

export function AnalyticsPanel({ suiteId }: { suiteId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['stats', suiteId],
    queryFn: () => api.getStats(suiteId),
    refetchInterval: 10000,
  });

  if (isLoading) return <p className="text-slate-400 text-sm">Loading analytics…</p>;
  if (!data) return null;

  const trend = data.passRateTrend.map((r, i) => ({
    label: `#${i + 1}`,
    passRate: Math.round(r.passRate * 100),
  }));

  const sorted = [...data.caseStats].sort((a, b) => b.flakinessScore - a.flakinessScore);

  return (
    <div className="space-y-6">
      {trend.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Pass rate over time (%)</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Line type="monotone" dataKey="passRate" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Flakiness leaderboard</h4>
        {sorted.length === 0 && <p className="text-xs text-slate-400">No data yet.</p>}
        <div className="space-y-2">
          {sorted.map((c: CaseStat) => (
            <div key={c.testCaseId} className="grid grid-cols-[1fr_auto_160px] gap-3 items-center">
              <span className="text-xs text-slate-700 truncate">{c.name}</span>
              <span className="text-xs text-slate-400">{c.totalRuns} runs</span>
              <FlakinessBar score={c.flakinessScore} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
