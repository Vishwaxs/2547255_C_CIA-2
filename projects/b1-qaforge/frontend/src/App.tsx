import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreateSuiteForm } from './components/CreateSuiteForm';
import { SuitesList } from './components/SuitesList';
import { RunsPanel } from './components/RunsPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { api } from './api';
import { Aurora } from './ui';

type Tab = 'runs' | 'analytics';

function SuiteDetail({ suiteId }: { suiteId: string }) {
  const [tab, setTab] = useState<Tab>('runs');
  const { data: suite } = useQuery({
    queryKey: ['suite', suiteId],
    queryFn: () => api.getSuite(suiteId),
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <Aurora />
      <div className="p-5 border-b border-slate-100">
        <p className="text-xs text-slate-400 mb-1">{suite?.baseUrl}</p>
        <h2 className="text-lg font-semibold text-slate-800">{suite?.name}</h2>
        {suite?.description && <p className="text-sm text-slate-500 mt-1">{suite.description}</p>}
        <div className="flex gap-1 mt-4">
          {(['runs', 'analytics'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize ${
                tab === t
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        {tab === 'runs' && <RunsPanel suiteId={suiteId} />}
        {tab === 'analytics' && <AnalyticsPanel suiteId={suiteId} />}
      </div>
    </div>
  );
}

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-bold text-slate-800">
          QAForge <span className="text-slate-400 font-normal text-sm">— API test orchestrator</span>
        </h1>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-[320px_1fr] gap-6">
        <aside className="space-y-4">
          <CreateSuiteForm />
          <SuitesList onSelect={setSelectedId} selectedId={selectedId} />
        </aside>
        <section>
          {selectedId ? (
            <SuiteDetail suiteId={selectedId} />
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              Select a suite to view runs and analytics.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
