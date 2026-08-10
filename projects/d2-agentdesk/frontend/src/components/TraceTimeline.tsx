import { useState } from 'react';
import { AgentStep, Observation, isTerminal } from '../types';
import { Badge, StatusDot, SectionLabel, TypeOut, Reveal } from '../ui';

/**
 * The centrepiece: one agent run rendered as a vertical rail of Thought -> Action ->
 * Observation cycles, ending in a verdict.
 *
 * Two decisions drive the whole layout. First, terminal actions are drawn as a full-width
 * verdict banner rather than another tool card, because "the agent decided to stop" is a
 * categorically different event from "the agent called something" and collapsing them into
 * one visual makes the trace much harder to read. Second, the thought types itself out,
 * which sounds gratuitous but is the thing that makes people actually read the reasoning
 * instead of scrolling straight to the answer — and the reasoning is the entire point.
 */

const ACTION_TONE: Record<string, 'info' | 'warn' | 'danger'> = {
  search_kb: 'info',
  lookup_order: 'info',
  issue_refund: 'warn',
};

function Row({ k, v }: { k: string; v: unknown }) {
  const text = typeof v === 'string' ? v : JSON.stringify(v);
  return (
    <div className="flex gap-2 text-[11.5px] leading-relaxed">
      <span className="mono shrink-0" style={{ color: 'var(--faint)' }}>
        {k}
      </span>
      <span className="mono break-all" style={{ color: 'var(--muted)' }}>
        {text}
      </span>
    </div>
  );
}

/** Article hits get a dedicated read-out — a bare JSON dump buries the score and the
 *  matched terms, which are the evidence for the agent's decision. */
function ArticleHits({ hits, rejected }: { hits: Record<string, unknown>[]; rejected: boolean }) {
  return (
    <div className="space-y-1.5 mt-2">
      {hits.map((h, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
          style={{
            background: rejected ? 'rgba(251,191,36,0.055)' : 'rgba(52,211,153,0.055)',
            border: `1px solid ${rejected ? 'rgba(251,191,36,0.2)' : 'rgba(52,211,153,0.2)'}`,
          }}
        >
          <span className="mono text-[11px] shrink-0" style={{ color: rejected ? 'var(--warn)' : 'var(--ok)' }}>
            {String(h.score)}
          </span>
          <span className="text-[12px] truncate flex-1" style={{ color: 'var(--text)' }}>
            {String(h.title)}
          </span>
          <span className="mono text-[10px] shrink-0" style={{ color: 'var(--faint)' }}>
            [{(h.matchedTerms as string[])?.join(' ') ?? ''}]
          </span>
        </div>
      ))}
    </div>
  );
}

function ObservationBlock({ obs }: { obs: Observation }) {
  const [open, setOpen] = useState(false);
  const results = (obs.data?.results as Record<string, unknown>[]) ?? [];
  const rejected = (obs.data?.rejected as Record<string, unknown>[]) ?? [];
  const orders = (obs.data?.orders as Record<string, unknown>[]) ?? [];
  const hasRaw = Object.keys(obs.data ?? {}).length > 0;

  return (
    <div className="mt-3 pl-3" style={{ borderLeft: `2px solid ${obs.ok ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.3)'}` }}>
      <div className="flex items-start gap-2">
        <span className="mt-1.5">
          <StatusDot tone={obs.ok ? 'ok' : 'warn'} />
        </span>
        <p className="text-[12.5px] leading-relaxed flex-1" style={{ color: 'var(--muted)' }}>
          {obs.summary}
        </p>
      </div>

      {results.length > 0 && <ArticleHits hits={results} rejected={false} />}
      {rejected.length > 0 && <ArticleHits hits={rejected} rejected />}

      {orders.length > 0 && (
        <div className="mt-2 space-y-1">
          {orders.map((o, i) => (
            <div key={i} className="flex items-center gap-2 text-[11.5px]">
              <span className="mono" style={{ color: 'var(--faint)' }}>
                ${Number(o.amount).toFixed(2)}
              </span>
              <span style={{ color: 'var(--text)' }}>{String(o.product)}</span>
              <Badge tone={o.status === 'refunded' ? 'warn' : 'muted'}>{String(o.status)}</Badge>
            </div>
          ))}
        </div>
      )}

      {hasRaw && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="btn btn-ghost mt-2 !px-2 !py-1 !text-[10.5px] label"
          >
            {open ? '− raw observation' : '+ raw observation'}
          </button>
          {open && (
            <pre
              className="mono text-[10.5px] leading-relaxed mt-1.5 p-3 rounded-lg overflow-x-auto"
              style={{ background: 'rgba(0,0,0,.42)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              {JSON.stringify(obs.data, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

function Verdict({ step }: { step: AgentStep }) {
  const escalated = step.action === 'escalate';
  const message = String(step.actionInput.message ?? step.actionInput.detail ?? '');

  return (
    <Reveal>
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: escalated
            ? 'linear-gradient(135deg, rgba(251,191,36,.1), rgba(251,113,133,.05))'
            : 'linear-gradient(135deg, rgba(52,211,153,.1), rgba(56,189,248,.05))',
          border: `1px solid ${escalated ? 'rgba(251,191,36,.28)' : 'rgba(52,211,153,.28)'}`,
        }}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <StatusDot tone={escalated ? 'warn' : 'ok'} />
          <span className="label" style={{ color: escalated ? 'var(--warn)' : 'var(--ok)' }}>
            {escalated ? 'Escalated to a human' : 'Resolved autonomously'}
          </span>
          <span className="flex-1" />
          <span className="mono text-[10.5px]" style={{ color: 'var(--faint)' }}>
            step {step.stepNumber}
          </span>
        </div>

        <p
          className="text-[12.5px] italic leading-relaxed mb-3 pl-3"
          style={{ color: 'var(--muted)', borderLeft: '2px solid var(--border-hi)' }}
        >
          {step.thought}
        </p>

        {message && (
          <p className="text-[13.5px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--text)' }}>
            {message}
          </p>
        )}
      </div>
    </Reveal>
  );
}

function ToolStep({ step, index }: { step: AgentStep; index: number }) {
  return (
    <Reveal delay={index * 60}>
      <div className="relative pl-9">
        {/* The rail and its node. The connector is drawn per-step rather than as one
            absolute line so it always ends exactly where the last step does. */}
        <span
          className="absolute left-[11px] top-8 bottom-[-20px] w-px"
          style={{ background: 'linear-gradient(180deg, var(--border-hi), var(--border))' }}
        />
        <span
          className="absolute left-0 top-[7px] flex items-center justify-center rounded-full mono text-[10px]"
          style={{
            width: 23,
            height: 23,
            background: 'var(--bg-elev)',
            border: '1px solid var(--border-hi)',
            color: 'var(--accent)',
          }}
        >
          {step.stepNumber}
        </span>

        <div className="card card-hover p-4">
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <Badge tone={ACTION_TONE[step.action] ?? 'muted'}>{step.action}</Badge>
            {Object.entries(step.actionInput).map(([k, v]) => (
              <span key={k} className="mono text-[10.5px]" style={{ color: 'var(--faint)' }}>
                {k}={typeof v === 'string' ? v : JSON.stringify(v)}
              </span>
            ))}
            <span className="flex-1" />
            <span className="mono text-[10.5px]" style={{ color: 'var(--faint)' }}>
              {step.durationMs}ms
            </span>
          </div>

          <div className="flex gap-2">
            <span className="label shrink-0 mt-[3px]">think</span>
            <p className="text-[13px] leading-relaxed italic flex-1" style={{ color: 'var(--text)' }}>
              <TypeOut text={step.thought} />
            </p>
          </div>

          <ObservationBlock obs={step.observation} />
        </div>
      </div>
    </Reveal>
  );
}

export function TraceTimeline({ steps }: { steps: AgentStep[] }) {
  if (steps.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
          No trace yet — this ticket has not been run.
        </p>
        <p className="text-[12px] mt-1" style={{ color: 'var(--faint)' }}>
          Run the agent to watch it reason step by step.
        </p>
      </div>
    );
  }

  const tools = steps.filter((s) => !isTerminal(s.action));
  const terminal = steps.find((s) => isTerminal(s.action));

  return (
    <div>
      <SectionLabel
        right={
          <span className="mono text-[10.5px]" style={{ color: 'var(--faint)' }}>
            {steps.length} steps · {steps.reduce((a, s) => a + s.durationMs, 0)}ms
          </span>
        }
      >
        reasoning trace
      </SectionLabel>

      <div className="space-y-5">
        {tools.map((s, i) => (
          <ToolStep key={s.id} step={s} index={i} />
        ))}
        {terminal && <Verdict step={terminal} />}
      </div>
    </div>
  );
}
