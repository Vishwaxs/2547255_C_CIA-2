import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { FlagListItem, FlagDetail, Condition, Serve } from '../types';
import { OPS } from '../types';

export function FlagsPanel() {
  const qc = useQueryClient();
  const flags = useQuery({ queryKey: ['flags'], queryFn: api.listFlags });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const seed = useMutation({
    mutationFn: api.seedFlags,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flags'] }),
    onError: (e: Error) => setErr(e.message),
  });
  const toggle = useMutation({
    mutationFn: (f: FlagListItem) => api.patchFlag(f.key, { enabled: !f.enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flags'] }),
    onError: (e: Error) => setErr(e.message),
  });
  const del = useMutation({
    mutationFn: (key: string) => api.deleteFlag(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flags'] }),
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Flags</h2>
          <p className="text-sm text-slate-500">Boolean &amp; multivariate flags with ordered targeting rules.</p>
        </div>
        <button
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
          className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {seed.isPending ? 'Seeding…' : 'Seed demo flags'}
        </button>
      </div>

      {err && <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">{err}</div>}

      <CreateFlagForm onDone={() => qc.invalidateQueries({ queryKey: ['flags'] })} onError={setErr} />

      <div className="space-y-3">
        {flags.isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {flags.data?.length === 0 && <p className="text-sm text-slate-400">No flags yet — create one or seed the demo set.</p>}
        {flags.data?.map((f) => (
          <div key={f.id} className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => toggle.mutate(f)}
                title={f.enabled ? 'Enabled — click to turn off' : 'Off — click to enable'}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${f.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${f.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800 truncate">{f.name}</span>
                  <code className="text-xs text-slate-400">{f.key}</code>
                </div>
                <div className="text-xs text-slate-500">
                  {f.variations.length} variations · {f._count?.rules ?? 0} rules · off → <code>{f.offVariationKey}</code>
                </div>
              </div>
              <button onClick={() => setExpanded(expanded === f.key ? null : f.key)} className="text-sm text-indigo-600 hover:underline">
                {expanded === f.key ? 'Hide rules' : 'Rules'}
              </button>
              <button onClick={() => del.mutate(f.key)} className="text-sm text-slate-400 hover:text-rose-600">
                Delete
              </button>
            </div>
            {expanded === f.key && <FlagRules flagKey={f.key} onError={setErr} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateFlagForm({ onDone, onError }: { onDone: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () =>
      api.createFlag({
        key: key.trim(),
        name: name.trim() || key.trim(),
        enabled: true,
        variations: [
          { key: 'on', value: true },
          { key: 'off', value: false },
        ],
        fallthrough: { variationKey: 'off' },
        offVariationKey: 'off',
      }),
    onSuccess: () => {
      setKey('');
      setName('');
      setOpen(false);
      onDone();
    },
    onError: (e: Error) => onError(e.message),
  });

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-indigo-600 hover:underline">
        + New boolean flag
      </button>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (key.trim()) create.mutate();
      }}
      className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-end gap-3"
    >
      <label className="text-sm">
        <span className="block text-slate-500 mb-1">Key</span>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="new-checkout" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="text-sm">
        <span className="block text-slate-500 mb-1">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New checkout" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <span className="text-xs text-slate-400 pb-2">variations on/off · fallthrough → off</span>
      <div className="flex gap-2 ml-auto">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm rounded-lg text-slate-500 hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" disabled={create.isPending || !key.trim()} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">
          Create
        </button>
      </div>
    </form>
  );
}

function FlagRules({ flagKey, onError }: { flagKey: string; onError: (m: string) => void }) {
  const qc = useQueryClient();
  const detail = useQuery<FlagDetail>({ queryKey: ['flag', flagKey], queryFn: () => api.getFlag(flagKey) });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['flag', flagKey] });
    qc.invalidateQueries({ queryKey: ['flags'] });
  };

  const addRule = useMutation({
    mutationFn: (data: { conditions: Condition[]; serve: Serve }) => api.addRule(flagKey, data),
    onSuccess: invalidate,
    onError: (e: Error) => onError(e.message),
  });
  const delRule = useMutation({
    mutationFn: (ruleId: string) => api.deleteRule(flagKey, ruleId),
    onSuccess: invalidate,
    onError: (e: Error) => onError(e.message),
  });

  const variations = detail.data?.variations ?? [];
  const [attribute, setAttribute] = useState('country');
  const [op, setOp] = useState('in');
  const [values, setValues] = useState('US, CA');
  const [serveKey, setServeKey] = useState('');

  return (
    <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/60">
      <div className="space-y-2">
        {detail.data?.rules.length === 0 && <p className="text-xs text-slate-400">No rules — every unit falls through to the fallthrough variation.</p>}
        {detail.data?.rules.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-slate-200 text-slate-600 text-xs font-mono">{r.order}</span>
            <span className="text-slate-600">
              {r.conditions.map((c, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-slate-400"> AND </span>}
                  <code className="text-slate-800">{c.attribute}</code> <span className="text-indigo-600">{c.op}</span> <code className="text-slate-800">{JSON.stringify(c.values)}</code>
                </span>
              ))}
              {r.conditions.length === 0 && <span className="text-slate-400">(no conditions — always matches)</span>}
              <span className="text-slate-400"> → serve </span>
              <code className="text-emerald-700">{r.serve.variationKey ?? 'rollout'}</code>
            </span>
            <button onClick={() => delRule.mutate(r.id)} className="ml-auto text-xs text-slate-400 hover:text-rose-600">
              remove
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const skey = serveKey || variations[0]?.key;
          if (!skey) return;
          const parsed = values
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
            .map((v) => (isFinite(Number(v)) && v !== '' ? Number(v) : v));
          addRule.mutate({
            conditions: op === 'exists' ? [{ attribute, op, values: [] }] : [{ attribute, op, values: parsed }],
            serve: { variationKey: skey },
          });
        }}
        className="flex flex-wrap items-end gap-2 pt-2 border-t border-slate-200 text-sm"
      >
        <label>
          <span className="block text-slate-400 text-xs mb-1">attribute</span>
          <input value={attribute} onChange={(e) => setAttribute(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 w-28" />
        </label>
        <label>
          <span className="block text-slate-400 text-xs mb-1">op</span>
          <select value={op} onChange={(e) => setOp(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5">
            {OPS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className={op === 'exists' ? 'opacity-40 pointer-events-none' : ''}>
          <span className="block text-slate-400 text-xs mb-1">values (comma-sep)</span>
          <input value={values} onChange={(e) => setValues(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 w-40" />
        </label>
        <label>
          <span className="block text-slate-400 text-xs mb-1">serve</span>
          <select value={serveKey || variations[0]?.key || ''} onChange={(e) => setServeKey(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5">
            {variations.map((v) => (
              <option key={v.key} value={v.key}>
                {v.key}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={addRule.isPending} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">
          Add rule
        </button>
      </form>
    </div>
  );
}
