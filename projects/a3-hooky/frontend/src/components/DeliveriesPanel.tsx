import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, STATUS_STYLE } from '../api';
import type { DeliveryDetail } from '../types';

const STATUSES = ['', 'pending', 'retrying', 'delivered', 'dead'];

export function DeliveriesPanel() {
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: deliveries } = useQuery({
    queryKey: ['deliveries', status],
    queryFn: () => api.listDeliveries(status || undefined),
    refetchInterval: 2000, // poll so status transitions show as the worker runs
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">filter:</span>
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`text-xs px-2 py-1 rounded-lg font-medium cursor-pointer ${
              status === s ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {s || 'all'}
          </button>
        ))}
      </div>

      {deliveries && deliveries.length === 0 && (
        <p className="text-sm text-slate-400">
          No deliveries{status ? ` with status "${status}"` : ''}. Publish an event to fan some out.
        </p>
      )}

      <ul className="space-y-2">
        {deliveries?.map((d) => (
          <li key={d.id} className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="flex items-center gap-3 p-3">
              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${STATUS_STYLE[d.status] ?? ''}`}>
                {d.status}
              </span>
              <span className="text-sm font-medium text-slate-800">{d.subscription.name}</span>
              <span className="text-xs text-slate-400">{d.event.type}</span>
              <span className="text-xs text-slate-400">· {d.attempts} attempt{d.attempts === 1 ? '' : 's'}</span>
              {d.lastError && <span className="text-xs text-rose-500 truncate max-w-[220px]">{d.lastError}</span>}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setOpenId(openId === d.id ? null : d.id)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  {openId === d.id ? 'Hide' : 'Attempts'}
                </button>
              </div>
            </div>
            {openId === d.id && <DeliveryDrawer id={d.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeliveryDrawer({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data } = useQuery<DeliveryDetail>({ queryKey: ['delivery', id], queryFn: () => api.getDelivery(id), refetchInterval: 2000 });
  const replay = useMutation({
    mutationFn: () => api.replayDelivery(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery', id] });
      qc.invalidateQueries({ queryKey: ['deliveries'] });
    },
  });
  if (!data) return <p className="text-xs text-slate-400 px-3 pb-3">Loading…</p>;

  return (
    <div className="border-t border-slate-100 px-3 py-3 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 font-mono truncate">{data.subscription.endpoint}</span>
        <button
          onClick={() => replay.mutate()}
          disabled={replay.isPending}
          className="ml-auto text-xs font-medium px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
        >
          {replay.isPending ? 'Replaying…' : 'Replay'}
        </button>
      </div>
      <ol className="space-y-1.5">
        {data.attemptLog.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-xs">
            <span className="font-mono text-slate-400 w-8">#{a.attempt}</span>
            <span className={`h-2 w-2 rounded-full ${a.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-slate-600">{a.ok ? 'delivered' : 'failed'}</span>
            {a.statusCode != null && <span className="text-slate-400">HTTP {a.statusCode}</span>}
            {a.error && <span className="text-rose-500 truncate max-w-[280px]">{a.error}</span>}
            <span className="ml-auto text-slate-400">{new Date(a.at).toLocaleTimeString()}</span>
          </li>
        ))}
        {data.attemptLog.length === 0 && <li className="text-xs text-slate-400">No attempts yet — awaiting dispatch.</li>}
      </ol>
    </div>
  );
}
