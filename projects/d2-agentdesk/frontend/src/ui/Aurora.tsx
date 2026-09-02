import { useEffect, useRef } from 'react';

/**
 * The page ground: three slow drifting colour fields, a fine engineering grid, and a
 * vignette, all behind a blur. Fixed and pointer-events:none, so it never interferes
 * with the interface sitting on top of it.
 *
 * Written by hand rather than pulled from an animation library — the whole effect is
 * three CSS keyframed gradients and one pointer listener, and shipping a runtime
 * dependency for that would cost more than it saves. The grid also parallaxes very
 * slightly against the cursor, which is what stops the background reading as a flat
 * image and makes the surface feel like it has depth.
 */
export function Aurora() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let frame = 0;
    const onMove = (e: PointerEvent) => {
      // Coalesce to one update per frame; pointermove fires far faster than we paint.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = gridRef.current;
        if (!el) return;
        const x = (e.clientX / window.innerWidth - 0.5) * 14;
        const y = (e.clientY / window.innerHeight - 0.5) * 14;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Colour fields. Each drifts on its own period so they never resynchronise into
          an obvious loop. */}
      <div
        className="absolute rounded-full"
        style={{
          top: '-24%', left: '-14%', width: '62vw', height: '62vw',
          background: 'radial-gradient(circle, rgba(56,189,248,0.22), transparent 62%)',
          filter: 'blur(78px)',
          animation: 'kit-drift 26s ease-in-out infinite',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: '4%', right: '-18%', width: '58vw', height: '58vw',
          background: 'radial-gradient(circle, rgba(129,140,248,0.20), transparent 62%)',
          filter: 'blur(84px)',
          animation: 'kit-drift 34s ease-in-out infinite reverse',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          bottom: '-30%', left: '24%', width: '66vw', height: '66vw',
          background: 'radial-gradient(circle, rgba(192,132,252,0.15), transparent 64%)',
          filter: 'blur(94px)',
          animation: 'kit-drift 42s ease-in-out infinite',
        }}
      />

      {/* Engineering grid, masked so it fades out toward the edges rather than ending
          on a hard line. */}
      <div
        ref={gridRef}
        className="absolute"
        style={{
          inset: '-2%',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 38%, #000 35%, transparent 78%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 90% 70% at 50% 38%, #000 35%, transparent 78%)',
          transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      />

      {/* Vignette — pulls focus to the centre column and hides the gradient seams. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 78% 62% at 50% 0%, transparent 12%, rgba(5,7,13,0.72) 78%, var(--bg) 100%)',
        }}
      />
    </div>
  );
}
