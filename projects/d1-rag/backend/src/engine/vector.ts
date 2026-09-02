// Pure vector math for cosine-kNN retrieval. No dependencies, no I/O — this is the
// part of the pipeline that stays identical whether vectors come from the offline
// TF-IDF embedder or a real embedding API. Brute-force kNN here; pgvector is the
// documented scale path (see DECISIONS.md).

export function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function norm(a: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
  return Math.sqrt(sum);
}

// L2-normalize so cosine reduces to a dot product. A zero vector is returned as-is
// (it has no direction) rather than producing NaN.
export function l2normalize(a: number[]): number[] {
  const n = norm(a);
  if (n === 0) return a.slice();
  return a.map((v) => v / n);
}

// Cosine similarity, guarded against the zero vector (an empty / all-stopword chunk):
// returns 0 instead of dividing by zero.
export function cosine(a: number[], b: number[]): number {
  const denom = norm(a) * norm(b);
  if (denom === 0) return 0;
  return dot(a, b) / denom;
}

export interface ScoredCandidate {
  id: string;
  score: number;
}

// Rank candidates by cosine similarity to the query and return the top k.
// JS Array.sort is stable in V8, so equal scores keep input order (deterministic).
export function topKByCosine(
  query: number[],
  candidates: { id: string; vector: number[] }[],
  k: number,
): ScoredCandidate[] {
  const scored = candidates.map((c) => ({ id: c.id, score: cosine(query, c.vector) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, k));
}
