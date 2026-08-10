import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api';
import { OUTCOME_META, Outcome } from '../types';
import { Badge, CountUp, SectionLabel, SpotlightCard, Reveal } from '../ui';

const TONE_HEX: Record<string, string> = {
  ok: '#34d399',
  warn: '#fbbf24',
  danger: '#fb7185',
  info: '#38bdf8',
};

function Stat({ label, value, suffix = '', decimals = 0, hint }: {
  label: string; value: number; suffix?: string; decimals?: number; hint?: string;
}) {
  return (
    <SpotlightCard className="card-hover p-4">
      <div className="label">{label}</div>
      <div className="mono text-[26px] mt-1.5 gradient-text">
        <CountUp value={value} suffix={suffix} decimals={decimals} />
      </div>
      {hint && <div className="text-[11px] mt-1" style={{ color: 'var(--faint)' }}>{hint}</div>}
    </SpotlightCard>
  );
}

/** The agent's configuration and its aggregate behaviour. Showing the registered tools and
 *  the active planner keeps the architecture visible rather than buried in env vars. */
export function AgentPanel() {
  const agent = useQuery({ queryKey: ['agent'], queryFn: api.describeAgent });
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats });
  const s = stats.data;

  const chart = (s?.byOutcome ?? []).map((o) => ({
    name: OUTCOME_META[o.outcome as Outcome]?.label ?? o.outcome,
    count: o.count,
    fill: TONE_HEX[OUTCOME_META[o.outcome as Outcome]?.tone ?? 'info'],
  }));

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>run statistics</SectionLabel>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="tickets handled" value={s?.tickets ?? 0} />
          <Stat label="autonomy rate" value={s?.autonomyRate ?? 0} suffix="%" hint="resolved ÷ finished runs" />
          <Stat label="avg steps" value={s?.avgSteps ?? 0} decimals={2} hint={`ceiling ${agent.data?.maxSteps ?? 6}`} />
          <Stat label="avg run time" value={s?.avgRuntimeMs ?? 0} suffix="ms" />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div>
          <SectionLabel>outcome distribution</SectionLabel>
          {chart.length > 0 ? (
            <div className="card p-4" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={132}
                    tick={{ fill: '#8d97ad', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,.04)' }}
                    contentStyle={{
                      background: '#090d17',
                      border: '1px solid rgba(255,255,255,.14)',
                      borderRadius: 10,
                      fontSize: 12,
                      color: '#e9edf6',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 5, 5, 0]} barSize={17}>
                    {chart.map((c, i) => (
                      <Cell key={i} fill={c.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="card p-8 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
              No runs yet — seed the demo from the Tickets tab.
            </div>
          )}
        </div>

        <div>
          <SectionLabel right={<Badge tone="info">{agent.data?.planner ?? '…'}</Badge>}>
            tool registry
          </SectionLabel>
          <p className="text-[12px] mb-3 leading-relaxed" style={{ color: 'var(--faint)' }}>
            Everything the agent may do. The planner can only choose from this list plus the two
            terminal actions — it has no other route to the outside world.
          </p>
          <div className="space-y-2.5">
            {(agent.data?.tools ?? []).map((t, i) => (
              <Reveal key={t.name} delay={i * 60}>
                <SpotlightCard className="card-hover p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="mono text-[12.5px]" style={{ color: 'var(--accent)' }}>
                      {t.name}
                    </span>
                    <span className="mono text-[10.5px]" style={{ color: 'var(--faint)' }}>
                      {s?.byAction.find((a) => a.action === t.name)?.count ?? 0} calls
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                    {t.description}
                  </p>
                </SpotlightCard>
              </Reveal>
            ))}
            {(agent.data?.terminalActions ?? []).map((a) => (
              <div key={a} className="flex items-center gap-2 px-3.5 py-2 rounded-lg"
                style={{ background: 'var(--surface)', border: '1px dashed var(--border-hi)' }}>
                <span className="mono text-[12px]" style={{ color: 'var(--muted)' }}>{a}</span>
                <span className="text-[11.5px]" style={{ color: 'var(--faint)' }}>terminal action — ends the run</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
