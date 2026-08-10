import {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  useCallback,
  useRef,
} from 'react';
import { usePrefersReducedMotion } from './motion';

/**
 * Writes the cursor position into --mx/--my so the CSS `.spotlight` highlight can follow
 * it. Kept as a hook so any element can opt in without wrapping it in another div.
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const frame = useRef(0);

  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    if (frame.current) return;
    const { clientX, clientY } = e;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${clientX - r.left}px`);
      el.style.setProperty('--my', `${clientY - r.top}px`);
    });
  }, []);

  return { ref, onPointerMove };
}

/** A card that lights up under the cursor. The highlight is a CSS radial gradient, so the
 *  only per-frame work is writing two custom properties. */
export function SpotlightCard({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  const { ref, onPointerMove } = useSpotlight<HTMLDivElement>();
  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      className={`card spotlight ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * A button that leans a few pixels toward the cursor and springs back on exit.
 *
 * The displacement is capped and scaled to the button's own size, so it reads as
 * responsiveness rather than as the control running away from the pointer — the failure
 * mode of most magnetic buttons. Disabled and reduced-motion instances do not move at all.
 */
export function MagneticButton({
  children,
  className = '',
  strength = 0.28,
  ...rest
}: { children: ReactNode; strength?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const ref = useRef<HTMLButtonElement>(null);
  const frame = useRef(0);
  const reduced = usePrefersReducedMotion();

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (reduced || rest.disabled || frame.current) return;
    const { clientX, clientY } = e;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = (clientX - (r.left + r.width / 2)) * strength;
      const dy = (clientY - (r.top + r.height / 2)) * strength;
      const cap = 9;
      el.style.transform = `translate(${Math.max(-cap, Math.min(cap, dx))}px, ${Math.max(-cap, Math.min(cap, dy))}px)`;
    });
  };

  const reset = () => {
    const el = ref.current;
    if (el) el.style.transform = 'translate(0,0)';
  };

  return (
    <button
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      onBlur={reset}
      className={`btn ${className}`}
      style={{ transition: 'transform .32s cubic-bezier(.22,1,.36,1), background .2s, border-color .2s, box-shadow .2s' }}
      {...rest}
    >
      {children}
    </button>
  );
}

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

export function Badge({
  tone = 'muted',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

const TONE_VAR: Record<Tone, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  info: 'var(--accent)',
  muted: 'var(--faint)',
};

export function StatusDot({ tone = 'muted', live = false }: { tone?: Tone; live?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block rounded-full ${live ? 'live-dot' : ''}`}
      style={{
        width: 7,
        height: 7,
        background: TONE_VAR[tone],
        boxShadow: `0 0 9px ${TONE_VAR[tone]}`,
      }}
    />
  );
}

/** Uppercase hairline section heading with a rule that runs to the end of the row. */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="label">{children}</span>
      <span className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      {right}
    </div>
  );
}
