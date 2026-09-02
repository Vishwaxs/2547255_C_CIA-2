import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { ConnectorKind } from '../types';

const KINDS: { value: ConnectorKind; label: string }[] = [
  { value: 'mock_crm', label: 'Mock CRM' },
  { value: 'mock_sheet', label: 'Mock Sheet' },
  { value: 'mock_slack', label: 'Mock Slack' },
];

function RecordsDrawer({ connectorId }: { connectorId: string }) {
  const { data } = useQuery({
    queryKey: ['records', connectorId],
    queryFn: () => api.getConnectorRecords(connectorId),
  });
  if (!data) return <p className="text-xs text-slate-400 mt-2">Loading…</p>;
  if (data.length === 0) return <p className="text-xs text-slate-400 mt-2">No records yet.</p>;
  return (
    <div className="mt-2 space-y-1 max-h-48 overflow-auto">
      {data.map((r) => (
        <div key={r.id} className="text-[11px] font-mono bg-slate-50 rounded px-2 py-1">
          <span className="text-indigo-600">{r.externalId}</span>{' '}
          <span className="text-slate-500">{JSON.stringify(r.data)}</span>
        </div>
      ))}
    </div>
  );
}

export function ConnectorsPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ConnectorKind>('mock_crm');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: connectors } = useQuery({ queryKey: ['connectors'], queryFn: api.listConnectors });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['connectors'] });
    qc.invalidateQueries({ queryKey: ['records'] });
  };

  const create = useMutation({
    mutationFn: () => api.createConnector({ name: name.trim(), kind }),
    onSuccess: () => {
      setName('');
      invalidate();
    },
  });
  const seed = useMutation({
    mutationFn: (id: string) => api.seedConnector(id, 3),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteConnector(id),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Add connector</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
          className="space-y-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Connector name (e.g. Acme CRM)"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ConnectorKind)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={create.isPending}
            className="w-full bg-indigo-600 text-white text-sm font-medium rounded-lg py-2 hover:bg-indigo-700 disabled:opacity-50"
          >
            {create.isPending ? 'Adding…' : 'Add connector'}
          </button>
          {create.isError && (
            <p className="text-xs text-red-600">{(create.error as Error).message}</p>
          )}
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Connected systems{' '}
          <span className="text-slate-400 font-normal">({connectors?.length ?? 0})</span>
        </h2>
        <div className="space-y-2">
          {connectors?.map((c) => (
            <div key={c.id} className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.name}</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {c.kind} · {c.recordCount} records
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => seed.mutate(c.id)}
                    className="text-[11px] px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    Seed 3
                  </button>
                  <button
                    onClick={() => setOpenId(openId === c.id ? null : c.id)}
                    className="text-[11px] px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    {openId === c.id ? 'Hide' : 'View'}
                  </button>
                  <button
                    onClick={() => remove.mutate(c.id)}
                    className="text-[11px] px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {openId === c.id && <RecordsDrawer connectorId={c.id} />}
            </div>
          ))}
          {connectors?.length === 0 && (
            <p className="text-xs text-slate-400">
              No connectors yet. Add two (e.g. a CRM and a Sheet), seed the source, then build a
              flow.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
