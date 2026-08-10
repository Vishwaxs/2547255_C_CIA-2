import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { Badge, SectionLabel, SpotlightCard, Reveal } from '../ui';

/**
 * Read-only windows onto the world the agent acts in. Without this the trace is
 * unfalsifiable — you can watch the agent claim it refunded an order, but not confirm the
 * order actually flipped. This is the page that makes the demo checkable.
 */
export function WorldPanel() {
  const kb = useQuery({ queryKey: ['kb'], queryFn: api.listKb });
  const orders = useQuery({ queryKey: ['orders'], queryFn: () => api.listOrders() });

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <div>
        <SectionLabel
          right={
            <span className="mono text-[10.5px]" style={{ color: 'var(--faint)' }}>
              {kb.data?.length ?? 0} articles
            </span>
          }
        >
          knowledge base
        </SectionLabel>
        <p className="text-[12px] mb-3 leading-relaxed" style={{ color: 'var(--faint)' }}>
          Everything search_kb can draw on. If an answer is not in here, the agent escalates
          rather than inventing one.
        </p>

        {kb.isLoading && <div className="card p-6 shimmer" style={{ height: 110 }} />}
        <div className="space-y-3">
          {(kb.data ?? []).map((a, i) => (
            <Reveal key={a.id} delay={i * 50}>
              <SpotlightCard className="card-hover p-4">
                <h3 className="text-[13.5px] font-medium" style={{ color: 'var(--text)' }}>
                  {a.title}
                </h3>
                <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {a.body}
                </p>
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {a.tags.map((t) => (
                    <span key={t} className="mono text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--surface-hi)', color: 'var(--faint)' }}>
                      {t}
                    </span>
                  ))}
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
          {!kb.isLoading && (kb.data ?? []).length === 0 && (
            <div className="card p-6 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
              Empty — seed the demo from the Tickets tab.
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionLabel
          right={
            <span className="mono text-[10.5px]" style={{ color: 'var(--faint)' }}>
              {orders.data?.length ?? 0} orders
            </span>
          }
        >
          order system
        </SectionLabel>
        <p className="text-[12px] mb-3 leading-relaxed" style={{ color: 'var(--faint)' }}>
          The only state the agent can mutate, via issue_refund. Run the refund ticket and watch
          a row flip here.
        </p>

        {orders.isLoading && <div className="card p-6 shimmer" style={{ height: 110 }} />}
        <div className="space-y-2.5">
          {(orders.data ?? []).map((o, i) => (
            <Reveal key={o.id} delay={i * 50}>
              <SpotlightCard className="card-hover p-3.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[10.5px]" style={{ color: 'var(--faint)' }}>
                      {o.customerId}
                    </span>
                    <Badge tone={o.status === 'refunded' ? 'warn' : 'ok'}>{o.status}</Badge>
                  </div>
                  <p className="text-[13px] mt-1 truncate" style={{ color: 'var(--text)' }}>
                    {o.product}
                  </p>
                </div>
                <span className="mono text-[14px] shrink-0" style={{ color: 'var(--text)' }}>
                  ${o.amount.toFixed(2)}
                </span>
              </SpotlightCard>
            </Reveal>
          ))}
          {!orders.isLoading && (orders.data ?? []).length === 0 && (
            <div className="card p-6 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
              Empty — seed the demo from the Tickets tab.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
