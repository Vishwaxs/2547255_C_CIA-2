// Conflict detection + resolution for a one-way source→target sync.
//
// A conflict means BOTH sides changed since the flow last ran and they now
// disagree. If only the source changed, the source is authoritative and we
// simply update the target (handled by the sync engine, not here).

export const CONFLICT_STRATEGIES = ['source_wins', 'target_wins', 'newest_wins'] as const;
export type ConflictStrategy = (typeof CONFLICT_STRATEGIES)[number];

// Deterministic stringify (keys sorted) so payload comparison is order-independent.
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function payloadsEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

export interface ConflictInput {
  sourceUpdatedAt: Date;
  targetUpdatedAt: Date;
  lastSyncedAt: Date | null;
  mapped: Record<string, unknown>;
  targetData: Record<string, unknown>;
}

export function isConflict(i: ConflictInput): boolean {
  if (!i.lastSyncedAt) return false; // first sync — nothing to conflict with
  const sourceChanged = i.sourceUpdatedAt.getTime() > i.lastSyncedAt.getTime();
  const targetChanged = i.targetUpdatedAt.getTime() > i.lastSyncedAt.getTime();
  return sourceChanged && targetChanged && !payloadsEqual(i.mapped, i.targetData);
}

// Decide which side wins a conflict. Returns the winning side.
export function resolveConflict(
  strategy: ConflictStrategy,
  sourceUpdatedAt: Date,
  targetUpdatedAt: Date,
): 'source' | 'target' {
  switch (strategy) {
    case 'source_wins':
      return 'source';
    case 'target_wins':
      return 'target';
    case 'newest_wins':
      return sourceUpdatedAt.getTime() >= targetUpdatedAt.getTime() ? 'source' : 'target';
  }
}
