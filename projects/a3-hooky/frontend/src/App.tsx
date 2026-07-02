import { useState } from 'react';
import { DeliveriesPanel } from './components/DeliveriesPanel';
import { PublishPanel } from './components/PublishPanel';
import { SubscriptionsPanel } from './components/SubscriptionsPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';

type View = 'deliveries' | 'publish' | 'subscriptions' | 'analytics';
const TABS: { key: View; label: string }[] = [
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'publish', label: 'Publish' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'analytics', label: 'Analytics' },
];

export default function App() {
  const [view, setView] = useState<View>('deliveries');
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">
            Hooky <span className="text-slate-400 font-normal text-sm">— webhook gateway &amp; delivery</span>
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
        {view === 'deliveries' && <DeliveriesPanel />}
        {view === 'publish' && <PublishPanel />}
        {view === 'subscriptions' && <SubscriptionsPanel />}
        {view === 'analytics' && <AnalyticsPanel />}
      </main>
    </div>
  );
}
