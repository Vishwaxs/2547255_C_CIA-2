import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export function AlertsPanel() {
  const { data: alerts } = useQuery({ queryKey: ['alerts'], queryFn: api.listAlerts, refetchInterval: 5000 });
  if (!alerts) return <p className="text-sm text-slate-400">Loading…</p>;
  if (alerts.length === 0) return <p className="text-sm text-slate-400">No alerts yet — run the simulator and wait for a spike.</p>;

  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li
          key={a.id}
          className={`bg-white border rounded-lg p-3 shadow-sm flex items-center gap-3 ${
            a.resolvedAt ? 'opacity-60' : ''
          }`}
        >
          <span
            className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
              a.level === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {a.level}
          </span>
          <span className="text-sm text-slate-700 flex-1">{a.message}</span>
          <span className="text-xs text-slate-400">
            {a.resolvedAt ? 'resolved' : 'active'} · {new Date(a.ts).toLocaleTimeString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
