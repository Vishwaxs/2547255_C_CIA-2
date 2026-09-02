import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { RunSummary, RunDetail } from '../types';

function statusIcon(status: 'pass' | 'fail') {
  return status === 'pass'
    ? <span className="text-green-600 font-bold">✓</span>
    : <span className="text-red-500 font-bold">✗</span>;
}

function RunRow({ run, onClick }: { run: RunSummary; onClick: () => void }) {
  const pct = run.totalTests > 0 ? Math.round((run.passed / run.totalTests) * 100) : 0;
  const colour = pct === 100 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500';
  const pending = !run.completedAt;
  return (
    <tr
      className="hover:bg-slate-50 cursor-pointer text-sm"
      onClick={onClick}
    >
      <td className="py-2 px-3 text-slate-500 font-mono text-xs">{run.id.slice(-8)}</td>
      <td className="py-2 px-3 text-slate-600">{new Date(run.startedAt).toLocaleTimeString()}</td>
      <td className={`py-2 px-3 font-medium ${colour}`}>
        {pending ? '…running' : `${pct}% (${run.passed}/${run.totalTests})`}
      </td>
    </tr>
  );
}

function RunResultDetail({ runId }: { runId: string }) {
  const { data } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => api.getRun(runId),
    refetchInterval: (q) => (!q.state.data?.completedAt ? 2000 : false),
  });
  if (!data) return <p className="text-xs text-slate-400 p-2">Loading…</p>;
  return (
    <table className="w-full text-xs mt-2">
      <thead>
        <tr className="text-left text-slate-500 border-b">
          <th className="py-1 px-2">Test</th>
          <th className="py-1 px-2">Status</th>
          <th className="py-1 px-2">Duration</th>
          <th className="py-1 px-2">Reason</th>
        </tr>
      </thead>
      <tbody>
        {data.results.map((r) => (
          <tr key={r.id} className="border-b border-slate-100">
            <td className="py-1.5 px-2 text-slate-700">{r.testCase.name}</td>
            <td className="py-1.5 px-2">{statusIcon(r.status)}</td>
            <td className="py-1.5 px-2 text-slate-500">{r.durationMs}ms</td>
            <td className="py-1.5 px-2 text-slate-400 truncate max-w-xs">{r.failReason ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RunsPanel({ suiteId }: { suiteId: string }) {
  const qc = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: runs } = useQuery({
    queryKey: ['runs', suiteId],
    queryFn: () => api.listRuns(suiteId),
    refetchInterval: 3000,
  });

  const trigger = useMutation({
    mutationFn: () => api.triggerRun(suiteId),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['runs', suiteId] });
      qc.invalidateQueries({ queryKey: ['suites'] });
      setSelectedRunId(r.id);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700 text-sm">Runs</h3>
        <button
          onClick={() => trigger.mutate()}
          disabled={trigger.isPending}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
        >
          {trigger.isPending ? 'Triggering…' : '▶ Run Now'}
        </button>
      </div>
      {!runs?.length && <p className="text-xs text-slate-400">No runs yet.</p>}
      {runs && runs.length > 0 && (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-slate-500 text-xs border-b">
              <th className="py-1 px-3">ID</th>
              <th className="py-1 px-3">Started</th>
              <th className="py-1 px-3">Result</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <RunRow key={r.id} run={r} onClick={() => setSelectedRunId(r.id === selectedRunId ? null : r.id)} />
            ))}
          </tbody>
        </table>
      )}
      {selectedRunId && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-xs font-medium text-slate-600 mb-1">Run {selectedRunId.slice(-8)} — results</p>
          <RunResultDetail runId={selectedRunId} />
        </div>
      )}
    </div>
  );
}

// useState imported inline to keep the file order natural
import { useState } from 'react';
