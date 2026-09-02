import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export function MetricsPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [thresholdType, setThresholdType] = useState('none');
  const [thresholdValue, setThresholdValue] = useState('');

  const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: api.listMetrics });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['metrics'] });

  const create = useMutation({
    mutationFn: () =>
      api.createMetric({
        name,
        unit,
        thresholdType,
        thresholdValue: thresholdType === 'none' || thresholdValue === '' ? null : Number(thresholdValue),
      }),
    onSuccess: () => {
      setName('');
      setUnit('');
      setThresholdType('none');
      setThresholdValue('');
      invalidate();
    },
  });
  const seed = useMutation({ mutationFn: api.seedMetrics, onSuccess: invalidate });

  return (
    <div className="grid grid-cols-[340px_1fr] gap-6">
      <aside>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3"
        >
          <h2 className="text-sm font-semibold text-slate-700">Define a metric</h2>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name (e.g. queue_depth)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit (e.g. ms, %)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <select value={thresholdType} onChange={(e) => setThresholdType(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white">
              <option value="none">no threshold</option>
              <option value="max_avg">max avg</option>
              <option value="max_value">max value</option>
              <option value="max_rate">max rate</option>
            </select>
            <input value={thresholdValue} onChange={(e) => setThresholdValue(e.target.value)} placeholder="limit" disabled={thresholdType === 'none'} type="number" className="w-24 border border-slate-300 rounded-lg px-2 py-2 text-sm disabled:bg-slate-50" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={create.isPending || !name.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer">
              Save metric
            </button>
            <button type="button" onClick={() => seed.mutate()} disabled={seed.isPending} className="text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer">
              Seed defaults
            </button>
          </div>
        </form>
      </aside>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Metrics ({metrics?.length ?? 0})</h2>
        <ul className="space-y-2">
          {metrics?.map((m) => (
            <li key={m.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-800">{m.name}</span>
              {m.unit && <span className="text-xs text-slate-400">{m.unit}</span>}
              <span className="ml-auto text-xs text-slate-500">
                {m.thresholdType === 'none' ? 'no threshold' : `${m.thresholdType.replace('max_', 'max ')} ${m.thresholdValue}${m.unit}`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
