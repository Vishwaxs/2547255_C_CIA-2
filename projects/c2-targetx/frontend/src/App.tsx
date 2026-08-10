import { useState } from 'react';
import { FlagsPanel } from './components/FlagsPanel';
import { EvaluatePanel } from './components/EvaluatePanel';
import { ExperimentsPanel } from './components/ExperimentsPanel';
import { Aurora } from './ui';

type View = 'flags' | 'evaluate' | 'experiments';
const TABS: { key: View; label: string }[] = [
  { key: 'flags', label: 'Flags' },
  { key: 'evaluate', label: 'Evaluate' },
  { key: 'experiments', label: 'Experiments' },
];

export default function App() {
  const [view, setView] = useState<View>('flags');
  return (
    <div className="min-h-screen bg-slate-50">
      <Aurora />
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">
            TargetX <span className="text-slate-400 font-normal text-sm">— feature flags &amp; targeting</span>
          </h1>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setView(t.key)} className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${view === t.key ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {view === 'flags' && <FlagsPanel />}
        {view === 'evaluate' && <EvaluatePanel />}
        {view === 'experiments' && <ExperimentsPanel />}
      </main>
    </div>
  );
}
