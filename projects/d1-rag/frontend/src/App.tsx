import { useState } from 'react';
import { DocumentsPanel } from './components/DocumentsPanel';
import { AskPanel } from './components/AskPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { Aurora } from './ui';

type View = 'ask' | 'documents' | 'history' | 'analytics';

const TABS: { key: View; label: string }[] = [
  { key: 'ask', label: 'Ask' },
  { key: 'documents', label: 'Documents' },
  { key: 'history', label: 'History' },
  { key: 'analytics', label: 'Analytics' },
];

export default function App() {
  const [view, setView] = useState<View>('ask');

  return (
    <div className="min-h-screen bg-slate-50">
      <Aurora />
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">
            D1 RAG{' '}
            <span className="text-slate-400 font-normal text-sm">
              — retrieval-augmented Q&amp;A over your docs
            </span>
          </h1>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
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

      <main className="max-w-5xl mx-auto px-6 py-8">
        {view === 'ask' && <AskPanel />}
        {view === 'documents' && <DocumentsPanel />}
        {view === 'history' && <HistoryPanel />}
        {view === 'analytics' && <AnalyticsPanel />}
      </main>
    </div>
  );
}
