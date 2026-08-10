import { useState } from 'react';
import { LivePanel } from './components/LivePanel';
import { HistoryPanel } from './components/HistoryPanel';
import { MetricsPanel } from './components/MetricsPanel';
import { AlertsPanel } from './components/AlertsPanel';
import { Aurora } from './ui';

type View = 'live' | 'history' | 'metrics' | 'alerts';
const TABS: { key: View; label: string }[] = [
  { key: 'live', label: 'Live' },
  { key: 'history', label: 'History' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'alerts', label: 'Alerts' },
];

export default function App() {
  const [view, setView] = useState<View>('live');
  return (
    <div className="min-h-screen bg-slate-50">
      <Aurora />
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">
            PulseBoard{' '}
            <span className="text-slate-400 font-normal text-sm">— real-time metrics dashboard</span>
          </h1>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  view === t.key ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {view === 'live' && <LivePanel />}
        {view === 'history' && <HistoryPanel />}
        {view === 'metrics' && <MetricsPanel />}
        {view === 'alerts' && <AlertsPanel />}
      </main>
    </div>
  );
}
