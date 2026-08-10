// Portable UI kit shared across every project in this monorepo.
// Copy src/ui/ plus the kit.css import and the chrome matches everywhere.
export { Aurora } from './Aurora';
export { Reveal, ScrambleText, CountUp, TypeOut, usePrefersReducedMotion } from './motion';
export { SpotlightCard, MagneticButton, Badge, StatusDot, SectionLabel, useSpotlight } from './controls';
export type { Tone } from './controls';
