import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { RunSummary } from '../types';

function statusDot(run: RunSummary | null) {
  if (!run) return 'bg-slate-300';
  if (!run.completedAt) return 'bg-amber-400 animate-pulse';
  if (run.status === 'success') return 'bg-emerald-500';
  if (run.status === 'partial') return 'bg-amber-500';
  return 'bg-red-500';
}

export function FlowsList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { data: flows } = useQuery({
    queryKey: ['flows'],
    queryFn: api.listFlows,
    refetchInterval: 5000,
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">
        Flows <span className="text-slate-400 font-normal">({flows?.length ?? 0})</span>
      </h2>
      <div className="space-y-1">
        {flows?.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`w-full text-left rounded-lg px-3 py-2 transition ${
              selectedId === f.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusDot(f.lastRun)}`} />
              <span className="text-sm font-medium text-slate-800">{f.name}</span>
            </div>
            <p className="text-[11px] text-slate-400 ml-4 mt-0.5">
              {f.sourceConnector.name} → {f.targetConnector.name} · {f.mappingCount} mappings
              {f.schedule ? ` · cron ${f.schedule}` : ''}
            </p>
          </button>
        ))}
        {flows?.length === 0 && (
          <p className="text-xs text-slate-400">No flows yet. Build one above.</p>
        )}
      </div>
    </div>
  );
}
