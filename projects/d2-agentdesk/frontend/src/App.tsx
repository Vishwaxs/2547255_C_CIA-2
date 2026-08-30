import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { Aurora, Badge, ScrambleText, StatusDot } from './ui';
import { TicketsPanel } from './components/TicketsPanel';
import { WorldPanel } from './components/WorldPanel';
import { AgentPanel } from './components/AgentPanel';

type View = 'tickets' | 'world' | 'agent';

const TABS: { key: View; label: string; hint: string }[] = [
  { key: 'tickets', label: 'Queue', hint: 'Tickets and their reasoning traces' },
  { key: 'world', label: 'World', hint: 'What the agent can read and change' },
  { key: 'agent', label: 'Agent', hint: 'Tool registry and run statistics' },
];

export default function App() {
  const [view, setView] = useState<View>('tickets');
  // Probe the real dependencies, not an in-memory config endpoint: describeAgent returns
  // env vars and the tool registry, so it answers 200 even with Postgres face down.
  const health = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    retry: false,
    refetchInterval: 30_000,
  });
  const agent = useQuery({ queryKey: ['agent'], queryFn: api.describeAgent, retry: false });

  const h = health.data;
  const online = !!h?.reachable && h.postgres;
  // Redis is a fail-open cache, so losing it degrades performance, not correctness.
  const degraded = !!h?.reachable && h.postgres && !h.redis;

  return (
    <div className="min-h-screen">
      <Aurora />

      <header className="sticky top-0 z-20" style={{ backdropFilter: 'blur(14px)' }}>
        <div
          className="max-w-[1240px] mx-auto px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-baseline gap-3">
              <h1 className="text-[19px] font-bold tracking-tight">
                <span className="gradient-text mono">
                  <ScrambleText text="AgentDesk" />
                </span>
              </h1>
              <span className="text-[12.5px] hidden sm:inline" style={{ color: 'var(--faint)' }}>
                autonomous support agent — every decision on the record
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2">
                <StatusDot tone={online ? (degraded ? 'warn' : 'ok') : 'danger'} live={online} />
                <span className="mono text-[10.5px]" style={{ color: 'var(--faint)' }}>
                  {!h?.reachable
                    ? 'api unreachable'
                    : !h.postgres
                      ? 'postgres down'
                      : degraded
                        ? `api :4008 · redis down (cache off)`
                        : `api :4008 · ${agent.data?.planner ?? ''}`}
                </span>
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1 mt-3.5 flex-wrap">
            {TABS.map((t) => {
              const active = view === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  title={t.hint}
                  className="relative px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
                  style={{
                    color: active ? 'var(--text)' : 'var(--muted)',
                    background: active ? 'var(--surface-hi)' : 'transparent',
                  }}
                >
                  {t.label}
                  {active && (
                    <span
                      className="absolute left-3 right-3 -bottom-[1px] h-[2px] rounded-full"
                      style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-[1240px] mx-auto px-6 py-8">
        {!online && (
          <div
            className="rounded-xl px-4 py-3 mb-6 text-[13px]"
            style={{
              background: 'rgba(251,113,133,.1)',
              border: '1px solid rgba(251,113,133,.3)',
              color: 'var(--danger)',
            }}
          >
            {h?.reachable
              ? 'The API is up but Postgres is unreachable, so every data request will fail.'
              : 'Cannot reach the API on :4008.'}{' '}
            Start it with <code className="mono">npm run dev</code> in{' '}
            <code className="mono">backend/</code>.
          </div>
        )}

        {view === 'tickets' && <TicketsPanel />}
        {view === 'world' && <WorldPanel />}
        {view === 'agent' && <AgentPanel />}
      </main>

      <footer className="max-w-[1240px] mx-auto px-6 pb-10 pt-4">
        <div
          className="flex items-center justify-between gap-4 flex-wrap pt-5 text-[11.5px]"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--faint)' }}
        >
          <span>
            D2 AgentDesk — ReAct loop, tool registry, full audit trail. Part of the Portfolio
            Gap-Filler monorepo.
          </span>
          <span className="flex items-center gap-2">
            <Badge tone="muted">react 18</Badge>
            <Badge tone="muted">express</Badge>
            <Badge tone="muted">prisma</Badge>
            <Badge tone="muted">postgres</Badge>
          </span>
        </div>
      </footer>
    </div>
  );
}
