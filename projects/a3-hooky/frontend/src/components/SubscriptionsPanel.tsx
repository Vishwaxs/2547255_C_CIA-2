import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export function SubscriptionsPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('https://sink.local/ok');
  const [eventTypes, setEventTypes] = useState('*');
  const [mode, setMode] = useState('ok');
  const { data: subs } = useQuery({ queryKey: ['subscriptions'], queryFn: api.listSubscriptions });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['subscriptions'] });

  const create = useMutation({
    mutationFn: () => api.createSubscription({ name, endpoint, eventTypes: eventTypes.split(',').map((s) => s.trim()).filter(Boolean), mode }),
    onSuccess: () => {
      setName('');
      invalidate();
    },
  });
  const toggle = useMutation({ mutationFn: (v: { id: string; active: boolean }) => api.patchSubscription(v.id, { active: v.active }), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteSubscription(id), onSuccess: invalidate });

  return (
    <div className="grid grid-cols-[340px_1fr] gap-6">
      <aside>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Add a subscription</h2>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="endpoint URL" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input value={eventTypes} onChange={(e) => setEventTypes(e.target.value)} placeholder="event types (comma-sep, or *)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <label className="block text-xs text-slate-500">
            sink mode
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white">
              <option value="ok">ok (always delivers)</option>
              <option value="flaky">flaky (fails twice, then delivers)</option>
              <option value="fail">fail (always 500 → dead-letter)</option>
              <option value="slow">slow (times out)</option>
            </select>
          </label>
          <button type="submit" disabled={create.isPending || !name.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg cursor-pointer">
            Add subscription
          </button>
        </form>
      </aside>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Subscriptions ({subs?.length ?? 0})</h2>
        <ul className="space-y-2">
          {subs?.map((s) => (
            <li key={s.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${s.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                <p className="text-xs text-slate-400 truncate">{s.endpoint} · {(s.eventTypes as string[]).join(', ')} · mode {s.mode}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => toggle.mutate({ id: s.id, active: !s.active })} className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer">
                  {s.active ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => remove.mutate(s.id)} className="text-xs font-medium text-rose-500 hover:text-rose-700 cursor-pointer">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
