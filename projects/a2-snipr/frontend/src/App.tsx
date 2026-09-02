import { useState } from 'react';
import { CreateLinkForm } from './components/CreateLinkForm';
import { LinksTable } from './components/LinksTable';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { Aurora } from './ui';

export default function App() {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Aurora />
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Snipr</h1>
        <p className="text-slate-500">URL shortener with Redis-cached redirects and click analytics.</p>
      </header>

      <div className="space-y-8">
        <CreateLinkForm />

        <section>
          <h2 className="mb-3 text-lg font-semibold">Your links</h2>
          <LinksTable selectedCode={selectedCode} onSelect={setSelectedCode} />
        </section>

        {selectedCode && <AnalyticsPanel code={selectedCode} />}
      </div>

      <footer className="mt-12 text-center text-xs text-slate-400">
        Snipr · portfolio project · React + Express + Postgres + Redis
      </footer>
    </div>
  );
}
