import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export function PublishPanel() {
  const qc = useQueryClient();
  const [type, setType] = useState('order.created');
  const [payload, setPayload] = useState('{\n  "orderId": "A-100",\n  "total": 49.99\n}');
  const [result, setResult] = useState<string | null>(null);

  const publish = useMutation({
    mutationFn: () => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(payload);
      } catch {
        throw new Error('Payload is not valid JSON');
      }
      return api.publishEvent({ type, payload: parsed });
    },
    onSuccess: (r) => {
      setResult(`Published — fanned out to ${r.deliveries} subscription${r.deliveries === 1 ? '' : 's'}${r.deduped ? ' (deduped)' : ''}.`);
      qc.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
  const seed = useMutation({ mutationFn: api.seedSubscriptions, onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }) });

  return (
    <div className="max-w-xl space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          publish.mutate();
        }}
        className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3"
      >
        <h2 className="text-sm font-semibold text-slate-700">Publish an event</h2>
        <input value={type} onChange={(e) => setType(e.target.value)} placeholder="event type (e.g. order.created)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={6} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono resize-none" />
        <div className="flex gap-2">
          <button type="submit" disabled={publish.isPending || !type.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg cursor-pointer">
            {publish.isPending ? 'Publishing…' : 'Publish'}
          </button>
          <button type="button" onClick={() => seed.mutate()} disabled={seed.isPending} className="text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer">
            Seed demo subscriptions
          </button>
        </div>
        {publish.isError && <p className="text-xs text-rose-600">{(publish.error as Error).message}</p>}
        {result && <p className="text-xs text-emerald-600">{result}</p>}
      </form>
      <p className="text-xs text-slate-400">
        The demo subscriptions cover every delivery mode — reliable, flaky (fails twice then
        succeeds), broken (dead-letters), and slow (times out) — so the retry, backoff and
        dead-letter behaviour is visible on the Deliveries tab.
      </p>
    </div>
  );
}
