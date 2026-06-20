import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { ConflictStrategy, MappingInput, TransformName } from '../types';

const TRANSFORMS: TransformName[] = ['none', 'uppercase', 'lowercase', 'trim', 'number', 'date_iso'];
const STRATEGIES: ConflictStrategy[] = ['source_wins', 'target_wins', 'newest_wins'];

const emptyRow = (): MappingInput => ({ sourceField: '', targetField: '', transform: 'none' });

export function CreateFlowForm() {
  const qc = useQueryClient();
  const { data: connectors } = useQuery({ queryKey: ['connectors'], queryFn: api.listConnectors });

  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [strategy, setStrategy] = useState<ConflictStrategy>('source_wins');
  const [schedule, setSchedule] = useState('');
  const [rows, setRows] = useState<MappingInput[]>([emptyRow()]);

  const create = useMutation({
    mutationFn: () =>
      api.createFlow({
        name: name.trim(),
        sourceConnectorId: sourceId,
        targetConnectorId: targetId,
        conflictStrategy: strategy,
        schedule: schedule.trim() || null,
        mappings: rows.filter((r) => r.sourceField.trim() && r.targetField.trim()),
      }),
    onSuccess: () => {
      setName('');
      setRows([emptyRow()]);
      setSchedule('');
      qc.invalidateQueries({ queryKey: ['flows'] });
    },
  });

  const canSubmit = name.trim() && sourceId && targetId && sourceId !== targetId;

  const setRow = (i: number, patch: Partial<MappingInput>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Build a sync flow</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) create.mutate();
        }}
        className="space-y-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Flow name (e.g. CRM → Sheet)"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
          >
            <option value="">Source…</option>
            {connectors?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
          >
            <option value="">Target…</option>
            {connectors?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as ConflictStrategy)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
            title="Conflict resolution strategy"
          >
            {STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="cron (optional)"
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono"
            title="Cron expression for scheduled sync, e.g. */5 * * * *"
          />
        </div>

        <div className="pt-1">
          <p className="text-[11px] font-medium text-slate-500 mb-1">
            Field mappings (source → transform → target)
          </p>
          <div className="space-y-1">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center">
                <input
                  value={r.sourceField}
                  onChange={(e) => setRow(i, { sourceField: e.target.value })}
                  placeholder="source field"
                  className="text-xs border border-slate-200 rounded px-2 py-1.5 font-mono"
                />
                <select
                  value={r.transform}
                  onChange={(e) => setRow(i, { transform: e.target.value as TransformName })}
                  className="text-xs border border-slate-200 rounded px-1 py-1.5 bg-white"
                >
                  {TRANSFORMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  value={r.targetField}
                  onChange={(e) => setRow(i, { targetField: e.target.value })}
                  placeholder="target field"
                  className="text-xs border border-slate-200 rounded px-2 py-1.5 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                  className="text-slate-300 hover:text-red-500 px-1"
                  title="Remove mapping"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, emptyRow()])}
            className="text-[11px] text-indigo-600 hover:underline mt-1"
          >
            + add mapping
          </button>
        </div>

        <button
          type="submit"
          disabled={!canSubmit || create.isPending}
          className="w-full bg-indigo-600 text-white text-sm font-medium rounded-lg py-2 hover:bg-indigo-700 disabled:opacity-50 mt-1"
        >
          {create.isPending ? 'Creating…' : 'Create flow'}
        </button>
        {sourceId && sourceId === targetId && (
          <p className="text-xs text-amber-600">Source and target must differ.</p>
        )}
        {create.isError && <p className="text-xs text-red-600">{(create.error as Error).message}</p>}
      </form>
    </div>
  );
}
