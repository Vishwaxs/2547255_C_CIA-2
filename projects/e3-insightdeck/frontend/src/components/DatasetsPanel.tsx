import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { DatasetDetail } from '../types';

export function DatasetsPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [csv, setCsv] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: datasets } = useQuery({ queryKey: ['datasets'], queryFn: api.listDatasets });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['datasets'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };
  const create = useMutation({
    mutationFn: () => api.createDataset({ name, csv }),
    onSuccess: () => {
      setName('');
      setCsv('');
      invalidate();
    },
  });
  const seed = useMutation({ mutationFn: api.seedDataset, onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteDataset(id), onSuccess: invalidate });

  return (
    <div className="grid grid-cols-[380px_1fr] gap-6">
      <aside>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && csv.trim()) create.mutate();
          }}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3"
        >
          <h2 className="text-sm font-semibold text-slate-700">Upload a CSV</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dataset name"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={'date,region,revenue\n2026-01-01,North,250\n…'}
            rows={7}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono resize-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={create.isPending || !name.trim() || !csv.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer"
            >
              {create.isPending ? 'Analyzing…' : 'Add & profile'}
            </button>
            <button
              type="button"
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
              className="text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {seed.isPending ? 'Seeding…' : 'Seed demo data'}
            </button>
          </div>
          {create.isError && <p className="text-xs text-rose-600">{(create.error as Error).message}</p>}
        </form>
      </aside>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Datasets ({datasets?.length ?? 0})
        </h2>
        {datasets && datasets.length === 0 && (
          <p className="text-sm text-slate-400">No datasets yet. Seed the demo or paste a CSV.</p>
        )}
        <ul className="space-y-2">
          {datasets?.map((d) => (
            <li key={d.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{d.name}</p>
                  <p className="text-xs text-slate-400">
                    {d.source} · {d.rowCount} rows · {d.columnCount} cols · {d.deckCount} decks
                  </p>
                </div>
                <button
                  onClick={() => setOpenId(openId === d.id ? null : d.id)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  {openId === d.id ? 'Hide' : 'Profile'}
                </button>
                <button
                  onClick={() => remove.mutate(d.id)}
                  className="text-xs font-medium text-rose-500 hover:text-rose-700 cursor-pointer"
                >
                  Delete
                </button>
              </div>
              {openId === d.id && <DatasetProfile id={d.id} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function fmtStat(stats: Record<string, unknown>): string {
  if ('mean' in stats) return `min ${num(stats.min)} · mean ${num(stats.mean)} · max ${num(stats.max)}`;
  if ('topValues' in stats) {
    const tv = stats.topValues as { value: string; count: number }[];
    return tv.slice(0, 3).map((t) => `${t.value} (${t.count})`).join(', ');
  }
  if ('min' in stats && 'max' in stats) return `${stats.min} → ${stats.max}`;
  if ('trueCount' in stats) return `true ${stats.trueCount} · false ${stats.falseCount}`;
  return '';
}
function num(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 1 }) : String(v);
}

function DatasetProfile({ id }: { id: string }) {
  const { data } = useQuery<DatasetDetail>({
    queryKey: ['dataset', id],
    queryFn: () => api.getDataset(id),
  });
  if (!data) return <p className="text-xs text-slate-400 mt-2">Loading…</p>;
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 text-left">
            <th className="font-medium pb-1">column</th>
            <th className="font-medium pb-1">type</th>
            <th className="font-medium pb-1">nulls</th>
            <th className="font-medium pb-1">profile</th>
          </tr>
        </thead>
        <tbody>
          {data.columns.map((c) => (
            <tr key={c.id} className="border-t border-slate-50">
              <td className="py-1 font-medium text-slate-700">{c.name}</td>
              <td className="py-1">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{c.inferredType}</span>
              </td>
              <td className="py-1 text-slate-500">{c.nullCount}</td>
              <td className="py-1 text-slate-500 truncate max-w-[260px]">{fmtStat(c.stats)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
