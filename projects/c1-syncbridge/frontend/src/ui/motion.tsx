import { useEffect, useRef, useState, ReactNode } from 'react';

/** One shared reduced-motion check. Every animated primitive below degrades to its final
 *  state immediately when the user has asked the OS to stop moving things — the content is
 *  never gated behind an animation that will not play. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * Reveals children once they scroll into view. IntersectionObserver rather than a scroll
 * handler, so it costs nothing while idle, and it unobserves after firing because a reveal
 * that replays on every scroll-by is a distraction, not an effect.
 */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduced) return setShown(true);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : `translateY(${y}px)`,
        transition: `opacity .55s cubic-bezier(.22,1,.36,1) ${delay}ms, transform .55s cubic-bezier(.22,1,.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

const GLYPHS = '▓▒░<>/\\{}[]()#$%&*+=~^|01';

/**
 * Resolves text out of noise, character by character. Used sparingly — the page title and
 * the outcome verdict — because it is an effect that earns attention exactly once and
 * becomes irritating if everything does it.
 */
export function ScrambleText({
  text,
  speed = 34,
  className = '',
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [out, setOut] = useState(reduced ? text : '');

  useEffect(() => {
    if (reduced) return setOut(text);
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      const settled = Math.floor(frame / 2);
      if (settled >= text.length) {
        setOut(text);
        clearInterval(id);
        return;
      }
      const noise = text
        .slice(settled)
        .split('')
        .map((c) => (c === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
        .join('');
      setOut(text.slice(0, settled) + noise);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, reduced]);

  // The real string stays in the accessibility tree; only the visual layer scrambles.
  return (
    <span className={className}>
      <span aria-hidden>{out}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/**
 * Counts a number up on mount with an ease-out curve, driven by requestAnimationFrame so it
 * stays smooth and pauses with the tab. A settling number reads as a live instrument;
 * a number that simply appears reads as static text.
 */
export function CountUp({
  value,
  duration = 900,
  decimals = 0,
  suffix = '',
  className = '',
}: {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  // Tracks what is currently painted, updated every frame. Animating from the last
  // *settled* value instead would make a mid-flight target change snap backwards to the
  // previous total before counting up again.
  const displayRef = useRef(0);

  useEffect(() => {
    if (reduced) return setDisplay(value);
    const from = displayRef.current;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (value - from) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return (
    <span className={className}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/**
 * Types text out one character at a time. Reserved for the agent's Thought lines, where it
 * is not decoration: it makes the reader move at the pace of the reasoning instead of
 * skimming past the most interesting part of the trace.
 */
export function TypeOut({
  text,
  speed = 9,
  className = '',
  onDone,
}: {
  text: string;
  speed?: number;
  className?: string;
  onDone?: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(reduced ? text.length : 0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (reduced) {
      setN(text.length);
      doneRef.current?.();
      return;
    }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      // Several characters per tick: one-per-tick is too slow to read comfortably at
      // sentence length, and a faster interval burns frames for no visible gain.
      i = Math.min(i + 2, text.length);
      setN(i);
      if (i >= text.length) {
        clearInterval(id);
        doneRef.current?.();
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, reduced]);

  return (
    <span className={className}>
      {text.slice(0, n)}
      {n < text.length && (
        <span
          aria-hidden
          className="inline-block w-[7px] h-[13px] -mb-[1px] ml-[1px] live-dot"
          style={{ background: 'var(--accent)' }}
        />
      )}
    </span>
  );
}
