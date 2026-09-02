import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { STREAM_URL, api } from '../api';
import type { MetricSnapshot, AlertItem, StreamPayload } from '../types';

const HISTORY = 30;

const STATUS: Record<string, { dot: string; ring: string; spark: string }> = {
  ok: { dot: 'bg-emerald-500', ring: 'border-slate-200', spark: '#4f46e5' },
  warning: { dot: 'bg-amber-500', ring: 'border-amber-200', spark: '#d97706' },
  critical: { dot: 'bg-rose-500', ring: 'border-rose-300', spark: '#e11d48' },
};

export function LivePanel() {
  const [metrics, setMetrics] = useState<MetricSnapshot[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const histRef = useRef<Map<string, number[]>>(new Map());
  const [, force] = useState(0);

  useEffect(() => {
    const es = new EventSource(STREAM_URL);
    es.addEventListener('hello', () => setConnected(true));
    es.addEventListener('snapshot', (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as StreamPayload;
      setMetrics(payload.metrics);
      setAlerts(payload.alerts);
      const h = histRef.current;
      for (const m of payload.metrics) {
        const arr = h.get(m.name) ?? [];
        arr.push(m.aggregate.avg);
        if (arr.length > HISTORY) arr.shift();
        h.set(m.name, arr);
      }
      force((n) => n + 1);
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  useEffect(() => {
    api.getSimulator().then((s) => setSimRunning(s.running)).catch(() => undefined);
  }, []);

  const toggleSim = async () => {
    const r = simRunning ? await api.stopSimulator() : await api.startSimulator();
    setSimRunning(r.running);
  };

  const activeAlerts = alerts.filter((a) => !a.resolvedAt);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            connected ? 'text-emerald-600' : 'text-slate-400'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          {connected ? 'live stream connected' : 'connecting…'}
        </span>
        <button
          onClick={toggleSim}
          className={`ml-auto text-sm font-medium px-4 py-1.5 rounded-lg cursor-pointer transition-colors ${
            simRunning
              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {simRunning ? 'Stop simulator' : 'Start simulator'}
        </button>
      </div>

      {metrics.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
          No metrics yet — start the simulator, or seed metrics in the Metrics tab.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <MetricTile key={m.id} m={m} history={histRef.current.get(m.name) ?? []} />
          ))}
        </div>
      )}

      {activeAlerts.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active alerts</h3>
          {activeAlerts.map((a) => (
            <div
              key={a.id}
              className={`text-xs rounded-lg px-3 py-2 border ${
                a.level === 'critical'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span className="font-semibold uppercase mr-2">{a.level}</span>
              {a.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricTile({ m, history }: { m: MetricSnapshot; history: number[] }) {
  const s = STATUS[m.status] ?? STATUS.ok;
  const data = history.map((v, i) => ({ i, v }));
  return (
    <div className={`bg-white border ${s.ring} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
        <span className="text-xs font-medium text-slate-500">{m.name}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-800 tabular-nums">{m.aggregate.avg.toFixed(1)}</span>
        <span className="text-xs text-slate-400">{m.unit}</span>
      </div>
      <div className="h-10 -mx-1 my-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="v" stroke={s.spark} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
        <span>{m.aggregate.ratePerSec.toFixed(1)}/s</span>
        <span>max {m.aggregate.max.toFixed(0)}</span>
      </div>
    </div>
  );
}
