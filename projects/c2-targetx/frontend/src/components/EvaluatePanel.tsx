import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { EvalResult } from '../types';

// Colour a reason badge by kind so the "why" is scannable at a glance.
function reasonClass(reason: string): string {
  if (reason === 'flag_off') return 'bg-slate-200 text-slate-600';
  if (reason.startsWith('rule_match')) return 'bg-indigo-100 text-indigo-700';
  if (reason === 'fallthrough') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

export function EvaluatePanel() {
  const flags = useQuery({ queryKey: ['flags'], queryFn: api.listFlags });
  const [flagKey, setFlagKey] = useState('');
  const [unitKey, setUnitKey] = useState('user-123');
  const [attrText, setAttrText] = useState('{\n  "country": "US",\n  "plan": "pro"\n}');
  const [single, setSingle] = useState<EvalResult | null>(null);
  const [all, setAll] = useState<Record<string, { variationKey: string; value: unknown; reason: string }> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const effectiveFlag = flagKey || flags.data?.[0]?.key || '';

  function parseAttrs(): Record<string, unknown> | null {
    try {
      const v = attrText.trim() ? JSON.parse(attrText) : {};
      if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('attributes must be a JSON object');
      return v as Record<string, unknown>;
    } catch (e) {
      setErr(`Invalid attributes JSON: ${(e as Error).message}`);
      return null;
    }
  }

  async function runOne() {
    setErr(null);
    setAll(null);
    const attributes = parseAttrs();
    if (!attributes || !effectiveFlag) return;
    try {
      setSingle(await api.evaluate(effectiveFlag, { unitKey, attributes }));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function runAll() {
    setErr(null);
    setSingle(null);
    const attributes = parseAttrs();
    if (!attributes) return;
    try {
      const res = await api.evaluateAll({ unitKey, attributes });
      setAll(res.flags);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Evaluate</h2>
        <p className="text-sm text-slate-500">
          Feed a unit key + attribute context and see the served variation — and <strong>why</strong>. The bucket is a deterministic hash of
          <code className="mx-1">flagKey:unitKey</code>, so the same unit is always sticky.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <label className="block text-sm">
            <span className="block text-slate-500 mb-1">Unit key (the bucketing identity)</span>
            <input value={unitKey} onChange={(e) => setUnitKey(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" />
          </label>
          <label className="block text-sm">
            <span className="block text-slate-500 mb-1">Attributes (JSON)</span>
            <textarea
              value={attrText}
              onChange={(e) => setAttrText(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-slate-500 mb-1">Flag (for single evaluate)</span>
            <select value={effectiveFlag} onChange={(e) => setFlagKey(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {flags.data?.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.name} ({f.key})
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button onClick={runOne} disabled={!effectiveFlag} className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">
              Evaluate flag
            </button>
            <button onClick={runAll} className="px-3 py-2 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-700">
              Evaluate all
            </button>
          </div>
          {err && <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">{err}</div>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {!single && !all && <p className="text-sm text-slate-400">Run an evaluation to see the result.</p>}

          {single && (
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Result — {single.flagKey}</div>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-slate-800">{single.variationKey}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${reasonClass(single.reason)}`}>{single.reason}</span>
              </div>
              <div className="text-sm text-slate-600">
                value: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{JSON.stringify(single.value)}</code>
              </div>
              {single.ruleOrder !== null && <div className="text-xs text-slate-400">matched rule #{single.ruleOrder}</div>}
            </div>
          )}

          {all && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">All flags for this context</div>
              {Object.entries(all).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-sm border-b border-slate-100 pb-2">
                  <code className="text-slate-500 flex-1 truncate">{k}</code>
                  <span className="font-medium text-slate-800">{v.variationKey}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${reasonClass(v.reason)}`}>{v.reason}</span>
                </div>
              ))}
              {Object.keys(all).length === 0 && <p className="text-sm text-slate-400">No flags defined.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
