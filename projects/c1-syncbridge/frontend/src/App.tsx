import { useState } from 'react';
import { ConnectorsPanel } from './components/ConnectorsPanel';
import { CreateFlowForm } from './components/CreateFlowForm';
import { FlowsList } from './components/FlowsList';
import { FlowDetail } from './components/FlowDetail';
import { Aurora } from './ui';

type View = 'connectors' | 'flows';

export default function App() {
  const [view, setView] = useState<View>('connectors');
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-50">
      <Aurora />
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">
            SyncBridge{' '}
            <span className="text-slate-400 font-normal text-sm">— integration hub (iPaaS-lite)</span>
          </h1>
          <nav className="flex gap-1">
            {(['connectors', 'flows'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium capitalize ${
                  view === v ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {v}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {view === 'connectors' && (
          <div className="max-w-md">
            <ConnectorsPanel />
          </div>
        )}
        {view === 'flows' && (
          <div className="grid grid-cols-[360px_1fr] gap-6">
            <aside className="space-y-4">
              <CreateFlowForm />
              <FlowsList selectedId={selectedFlow} onSelect={setSelectedFlow} />
            </aside>
            <section>
              {selectedFlow ? (
                <FlowDetail flowId={selectedFlow} />
              ) : (
                <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                  Select a flow to view its mappings, runs, and audit log.
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
