import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { OUTCOME_META, STATUS_TONE, TicketListItem, TicketStatus } from '../types';
import { Badge, MagneticButton, SectionLabel, SpotlightCard, StatusDot, Reveal, CountUp } from '../ui';
import { TraceTimeline } from './TraceTimeline';

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'escalated', label: 'Escalated' },
];

function ErrorBar({ message }: { message: string }) {
  return (
    <div
      className="rounded-lg px-3.5 py-2.5 text-[12.5px]"
      style={{ background: 'rgba(251,113,133,.1)', border: '1px solid rgba(251,113,133,.3)', color: 'var(--danger)' }}
    >
      {message}
    </div>
  );
}

function NewTicketForm({ onDone }: { onDone: (id: string) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('cust-101');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');

  const create = useMutation({
    mutationFn: () => api.createTicket({ customerId, subject, body }),
    onSuccess: (t) => {
      setSubject('');
      setBody('');
      setErr('');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      onDone(t.id);
    },
    onError: (e: Error) => setErr(e.message),
  });

  if (!open) {
    return (
      <MagneticButton onClick={() => setOpen(true)}>
        <span style={{ color: 'var(--accent)' }}>+</span> New ticket
      </MagneticButton>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <SectionLabel>file a ticket</SectionLabel>
      {err && <ErrorBar message={err} />}
      <div className="grid sm:grid-cols-[180px_1fr] gap-3">
        <input
          className="input mono"
          aria-label="Customer id"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="customer id"
        />
        <input
          className="input"
          aria-label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
        />
      </div>
      <textarea
        className="input"
        aria-label="Ticket body"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What is the customer asking for? Try a refund request, or a question the knowledge base cannot answer."
      />
      <div className="flex gap-2">
        <MagneticButton
          className="btn-primary"
          disabled={!subject.trim() || !body.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Filing…' : 'File ticket'}
        </MagneticButton>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <p className="text-[11.5px]" style={{ color: 'var(--faint)' }}>
        Filing does not run the agent. You trigger the loop yourself, so you can watch it reason.
      </p>
    </div>
  );
}

function TicketCard({
  ticket,
  selected,
  onSelect,
}: {
  ticket: TicketListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = ticket.outcome ? OUTCOME_META[ticket.outcome] : null;

  return (
    <SpotlightCard
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={`card-hover p-4 cursor-pointer transition-all ${selected ? '!border-[rgba(56,189,248,.45)]' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        // A div with onClick is invisible to the keyboard. Enter/Space restore the
        // activation behaviour a real button would have had.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-1.5">
          <StatusDot tone={STATUS_TONE[ticket.status]} live={ticket.status === 'open'} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="mono text-[10.5px]" style={{ color: 'var(--faint)' }}>
              {ticket.customerId}
            </span>
            {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
            {ticket.status === 'open' && <Badge tone="muted">awaiting run</Badge>}
          </div>
          <p className="text-[13.5px] font-medium mt-1 truncate" style={{ color: 'var(--text)' }}>
            {ticket.subject}
          </p>
          <div className="flex items-center gap-3 mt-1.5 mono text-[10.5px]" style={{ color: 'var(--faint)' }}>
            <span>{ticket.stepCount} steps</span>
            {ticket.runtimeMs !== null && <span>{ticket.runtimeMs}ms</span>}
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}

function TicketDetailView({ id }: { id: string }) {
  const qc = useQueryClient();
  const [err, setErr] = useState('');

  const ticket = useQuery({ queryKey: ['ticket', id], queryFn: () => api.getTicket(id) });

  const run = useMutation({
    mutationFn: () => api.runTicket(id),
    onSuccess: () => {
      setErr('');
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  if (ticket.isLoading) {
    return <div className="card p-8 shimmer" style={{ height: 180 }} />;
  }
  if (ticket.error) return <ErrorBar message={(ticket.error as Error).message} />;
  if (!ticket.data) return null;

  const t = ticket.data;
  const meta = t.outcome ? OUTCOME_META[t.outcome] : null;

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="mono text-[10.5px]" style={{ color: 'var(--faint)' }}>
                {t.customerId}
              </span>
              <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
              {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
            </div>
            <h2 className="text-[17px] font-semibold" style={{ color: 'var(--text)' }}>
              {t.subject}
            </h2>
            <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t.body}
            </p>
          </div>

          {t.status === 'open' ? (
            <MagneticButton className="btn-primary shrink-0" disabled={run.isPending} onClick={() => run.mutate()}>
              {run.isPending ? 'Reasoning…' : 'Run agent'}
            </MagneticButton>
          ) : (
            <div className="text-right shrink-0">
              <div className="mono text-[19px]" style={{ color: 'var(--accent)' }}>
                <CountUp value={t.runtimeMs ?? 0} suffix="ms" />
              </div>
              <div className="label mt-0.5">run time</div>
            </div>
          )}
        </div>

        {meta && (
          <p className="text-[12px] mt-3 pt-3" style={{ color: 'var(--faint)', borderTop: '1px solid var(--border)' }}>
            {meta.blurb}
          </p>
        )}
      </div>

      {err && <ErrorBar message={err} />}
      <TraceTimeline steps={t.steps} />
    </div>
  );
}

export function TicketsPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const tickets = useQuery({ queryKey: ['tickets', filter], queryFn: () => api.listTickets(filter) });

  const seed = useMutation({
    mutationFn: api.seed,
    onSuccess: () => {
      setErr('');
      qc.invalidateQueries();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const list = tickets.data ?? [];

  // A selection that has been filtered away, deleted, or never existed must not keep
  // driving the detail pane — otherwise the queue and the detail disagree about reality.
  const visible = selected && list.some((t) => t.id === selected) ? selected : null;

  return (
    <div className="grid lg:grid-cols-[minmax(300px,380px)_1fr] gap-6 items-start">
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="btn !py-1.5 !px-3 !text-[12px]"
              style={
                filter === f.key
                  ? { background: 'rgba(56,189,248,.13)', borderColor: 'rgba(56,189,248,.4)', color: 'var(--accent)' }
                  : undefined
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <NewTicketForm onDone={setSelected} />
          <MagneticButton disabled={seed.isPending} onClick={() => seed.mutate()}>
            {seed.isPending ? 'Seeding…' : 'Seed demo'}
          </MagneticButton>
        </div>

        {err && <ErrorBar message={err} />}
        {seed.data && (
          <p className="text-[11.5px] mono" style={{ color: 'var(--faint)' }}>
            +{seed.data.tickets} tickets · {seed.data.ran} run · {seed.data.skippedTickets} already present
          </p>
        )}

        <SectionLabel right={<span className="mono text-[10.5px]" style={{ color: 'var(--faint)' }}>{list.length}</span>}>
          queue
        </SectionLabel>

        {tickets.isLoading && <div className="card p-6 shimmer" style={{ height: 90 }} />}

        {tickets.isError && <ErrorBar message={`Could not load tickets — ${(tickets.error as Error).message}`} />}

        {!tickets.isLoading && !tickets.isError && list.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
              No tickets yet.
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--faint)' }}>
              Seed the demo to load five that each drive the agent down a different branch.
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          {list.map((t, i) => (
            <Reveal key={t.id} delay={i * 45}>
              <TicketCard ticket={t} selected={visible === t.id} onSelect={() => setSelected(t.id)} />
            </Reveal>
          ))}
        </div>
      </div>

      <div className="lg:sticky lg:top-6">
        {visible ? (
          // Keyed by id: TicketDetailView holds per-ticket error and mutation state, and
          // without a key React reuses the instance and leaks that state to the next ticket.
          <TicketDetailView key={visible} id={visible} />
        ) : (
          <div className="card p-10 text-center">
            <p className="text-[14px]" style={{ color: 'var(--muted)' }}>
              Select a ticket to inspect its reasoning trace.
            </p>
            <p className="text-[12.5px] mt-2 max-w-md mx-auto leading-relaxed" style={{ color: 'var(--faint)' }}>
              Every run records what the agent thought, which tool it called, and exactly what came
              back — including the matches it considered and rejected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
