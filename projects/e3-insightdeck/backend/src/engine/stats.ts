// Pure numeric helpers shared by column profiling and the insight detectors. No deps.

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function min(xs: number[]): number {
  return xs.reduce((a, b) => (b < a ? b : a), xs[0] ?? 0);
}

export function max(xs: number[]): number {
  return xs.reduce((a, b) => (b > a ? b : a), xs[0] ?? 0);
}

// Linear-interpolated quantile over a copy sorted ascending (q in [0,1]).
export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function median(xs: number[]): number {
  return quantile(xs, 0.5);
}

// Sample standard deviation (n-1). Returns 0 for fewer than 2 values.
export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

// Pearson correlation coefficient. Returns 0 when either series has no variance.
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  if (denom === 0) return 0;
  return num / denom;
}

export interface IqrBounds {
  q1: number;
  q3: number;
  iqr: number;
  lower: number;
  upper: number;
}

export function iqrBounds(xs: number[], factor = 1.5): IqrBounds {
  const q1 = quantile(xs, 0.25);
  const q3 = quantile(xs, 0.75);
  const iqr = q3 - q1;
  return { q1, q3, iqr, lower: q1 - factor * iqr, upper: q3 + factor * iqr };
}

// Least-squares slope/intercept of ys over xs (xs typically 0..n-1 for a time series).
export function linearTrend(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

// Sample skewness (Fisher-Pearson). Positive = right-tailed.
export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const m = mean(xs);
  const sd = stddev(xs);
  if (sd === 0) return 0;
  const s = xs.reduce((a, b) => a + Math.pow((b - m) / sd, 3), 0);
  return (n / ((n - 1) * (n - 2))) * s;
}
