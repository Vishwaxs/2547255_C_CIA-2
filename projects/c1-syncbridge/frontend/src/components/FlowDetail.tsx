import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { RunAudit } from './RunAudit';
import { AnalyticsPanel } from './AnalyticsPanel';

type Tab = 'runs' | 'analytics';

export function FlowDetail({ flowId }: { flowId: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('runs');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const { data: flow } = useQuery({ queryKey: ['flow', flowId], queryFn: () => api.getFlow(flowId) });
  const { data: runs } = useQuery({
    queryKey: ['flow-runs', flowId],
    queryFn: () => api.getFlowRuns(flowId),
    refetchInterval: 3000,
  });

  const trigger = useMutation({
    mutationFn: () => api.triggerFlow(flowId),
    onSuccess: (res) => {
      setActiveRunId(res.id);
      setTab('runs');
      qc.invalidateQueries({ queryKey: ['flow-runs', flowId] });
      qc.invalidateQueries({ queryKey: ['flows'] });
      qc.invalidateQueries({ queryKey: ['connectors'] });
    },
  });

  if (!flow) return <div className="text-sm text-slate-400 p-6">Loading flow…</div>;

  const shownRunId = activeRunId ?? runs?.[0]?.id ?? null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{flow.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {flow.sourceConnector.name}{' '}
              <span className="text-slate-300">({flow.sourceConnector.kind})</span> →{' '}
              {flow.targetConnector.name}{' '}
              <span className="text-slate-300">({flow.targetConnector.kind})</span>
            </p>
            <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                conflict: {flow.conflictStrategy}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                {flow.schedule ? `cron ${flow.schedule}` : 'manual'}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                last synced:{' '}
                {flow.lastSyncedAt ? new Date(flow.lastSyncedAt).toLocaleTimeString() : 'never'}
              </span>
            </div>
          </div>
          <button
            onClick={() => trigger.mutate()}
            disabled={trigger.isPending}
            className="bg-indigo-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-indigo-700 disabled:opacity-50"
          >
            {trigger.isPending ? 'Syncing…' : 'Sync now'}
          </button>
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-medium text-slate-500 mb-1">Field mappings</p>
          <div className="flex flex-wrap gap-1.5">
            {flow.mappings.map((m) => (
              <span
                key={m.id}
                className="text-[11px] font-mono bg-slate-50 border border-slate-100 rounded px-2 py-1"
              >
                {m.sourceField}
                {m.transform !== 'none' && <span className="text-amber-600"> ▸{m.transform}</span>} →{' '}
                {m.targetField}
              </span>
            ))}
            {flow.mappings.length === 0 && (
              <span className="text-[11px] text-slate-400">No mappings (records copied as-is).</span>
            )}
          </div>
        </div>

        <div className="flex gap-1 mt-4">
          {(['runs', 'analytics'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize ${
                tab === t ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {tab === 'runs' && (
          <div className="grid grid-cols-[180px_1fr] gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-500 mb-1">Recent runs</p>
              {runs?.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActiveRunId(r.id)}
                  className={`w-full text-left text-[11px] rounded px-2 py-1.5 ${
                    shownRunId === r.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium text-slate-700">{r.status}</span>
                  <span className="text-slate-400">
                    {' '}
                    · {new Date(r.startedAt).toLocaleTimeString()}
                  </span>
                  <br />
                  <span className="text-slate-400">
                    ↑{r.recordsUpserted} ·{r.recordsSkipped} skip · {r.recordsConflicted} conf
                  </span>
                </button>
              ))}
              {runs?.length === 0 && <p className="text-[11px] text-slate-400">No runs yet.</p>}
            </div>
            <div>{shownRunId ? <RunAudit runId={shownRunId} /> : <p className="text-xs text-slate-400">Trigger a sync to see the audit log.</p>}</div>
          </div>
        )}
        {tab === 'analytics' && <AnalyticsPanel flowId={flowId} />}
      </div>
    </div>
  );
}
