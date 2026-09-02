import { useState } from 'react';
import { DeckPanel } from './components/DeckPanel';
import { DatasetsPanel } from './components/DatasetsPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { Aurora } from './ui';

type View = 'deck' | 'datasets' | 'analytics';

const TABS: { key: View; label: string }[] = [
  { key: 'deck', label: 'Deck' },
  { key: 'datasets', label: 'Datasets' },
  { key: 'analytics', label: 'Analytics' },
];

export default function App() {
  const [view, setView] = useState<View>('deck');

  return (
    <div className="min-h-screen bg-slate-50">
      <Aurora />
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">
            InsightDeck{' '}
            <span className="text-slate-400 font-normal text-sm">
              — auto-generated insights from your data
            </span>
          </h1>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  view === t.key
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {view === 'deck' && <DeckPanel />}
        {view === 'datasets' && <DatasetsPanel />}
        {view === 'analytics' && <AnalyticsPanel />}
      </main>
    </div>
  );
}
