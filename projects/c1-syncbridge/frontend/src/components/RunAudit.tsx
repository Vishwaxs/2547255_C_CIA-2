import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { AuditEntry } from '../types';

const actionStyle: Record<AuditEntry['action'], string> = {
  created: 'bg-emerald-100 text-emerald-700',
  updated: 'bg-blue-100 text-blue-700',
  skipped: 'bg-slate-100 text-slate-500',
  conflict_resolved: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
};

export function RunAudit({ runId }: { runId: string }) {
  const { data: run } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => api.getRun(runId),
    // Poll while the run is still in flight (no completedAt yet).
    refetchInterval: (q) => (q.state.data && !q.state.data.completedAt ? 1500 : false),
  });

  if (!run) return <p className="text-xs text-slate-400">Loading run…</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-3">
        <span>
          status: <span className="font-medium text-slate-700">{run.status}</span>
        </span>
        <span>read: {run.recordsRead}</span>
        <span>upserted: {run.recordsUpserted}</span>
        <span>skipped: {run.recordsSkipped}</span>
        <span>
          conflicts: <span className="font-medium text-amber-600">{run.recordsConflicted}</span>
        </span>
        <span>trigger: {run.trigger}</span>
      </div>
      {!run.completedAt && (
        <p className="text-xs text-amber-600 mb-2">Run in progress — polling…</p>
      )}
      <div className="space-y-1 max-h-80 overflow-auto">
        {run.entries.map((e) => (
          <div key={e.id} className="border border-slate-100 rounded-lg px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-indigo-600">{e.externalId}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${actionStyle[e.action]}`}>
                {e.action}
              </span>
            </div>
            {e.detail && <p className="text-[11px] text-amber-700 mt-1">{e.detail}</p>}
            <div className="grid grid-cols-2 gap-2 mt-1.5 text-[10px] font-mono text-slate-500">
              <div className="bg-slate-50 rounded px-2 py-1 truncate" title={JSON.stringify(e.sourcePayload)}>
                src: {JSON.stringify(e.sourcePayload)}
              </div>
              <div className="bg-slate-50 rounded px-2 py-1 truncate" title={JSON.stringify(e.mappedPayload)}>
                → {JSON.stringify(e.mappedPayload)}
              </div>
            </div>
          </div>
        ))}
        {run.entries.length === 0 && (
          <p className="text-xs text-slate-400">No records processed in this run.</p>
        )}
      </div>
    </div>
  );
}
