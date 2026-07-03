import crypto from 'crypto';

// Consistent hashing for sticky percentage rollout. hashToUnit maps a string to a stable
// [0,1) float; bucket derives a 0..100 position for a (flag, unit) pair — the SAME user
// always lands in the SAME bucket for a given flag, so a rollout is sticky across calls and
// across servers. This is the LaunchDarkly-style bucketing technique.
export function hashToUnit(key: string): number {
  const hex = crypto.createHash('sha1').update(key).digest('hex').slice(0, 8);
  return parseInt(hex, 16) / 0x100000000; // 8 hex digits -> [0, 1)
}

export function bucket(flagKey: string, unitKey: string, salt = ''): number {
  return hashToUnit(`${flagKey}:${salt}:${unitKey}`) * 100;
}

export interface WeightedVariation {
  variationKey: string;
  weight: number;
}

// Deterministically pick a variation from weighted buckets given a 0..100 position. Weights
// are treated proportionally (normalized), so [{a,50},{b,50}] splits 50/50 and the last
// variation absorbs any rounding remainder.
export function assignVariant(rollout: WeightedVariation[], bucketPct: number): string {
  const total = rollout.reduce((a, r) => a + r.weight, 0) || 1;
  let cumulative = 0;
  for (const r of rollout) {
    cumulative += (r.weight / total) * 100;
    if (bucketPct < cumulative) return r.variationKey;
  }
  return rollout[rollout.length - 1].variationKey;
}
