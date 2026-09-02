import { isConflict, resolveConflict, payloadsEqual } from '../engine/conflict';

const t = (iso: string) => new Date(iso);

describe('payloadsEqual', () => {
  it('is order-independent on keys', () => {
    expect(payloadsEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(payloadsEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe('isConflict', () => {
  const base = {
    mapped: { name: 'NEW' },
    targetData: { name: 'OTHER' },
  };

  it('is never a conflict on the first sync (no lastSyncedAt)', () => {
    expect(
      isConflict({
        ...base,
        sourceUpdatedAt: t('2026-01-03'),
        targetUpdatedAt: t('2026-01-03'),
        lastSyncedAt: null,
      }),
    ).toBe(false);
  });

  it('requires BOTH sides to change since last sync', () => {
    const lastSyncedAt = t('2026-01-02');
    // only source changed → not a conflict
    expect(
      isConflict({
        ...base,
        sourceUpdatedAt: t('2026-01-03'),
        targetUpdatedAt: t('2026-01-01'),
        lastSyncedAt,
      }),
    ).toBe(false);
    // both changed and payloads differ → conflict
    expect(
      isConflict({
        ...base,
        sourceUpdatedAt: t('2026-01-03'),
        targetUpdatedAt: t('2026-01-03'),
        lastSyncedAt,
      }),
    ).toBe(true);
  });

  it('is not a conflict when both changed but payloads already agree', () => {
    expect(
      isConflict({
        mapped: { name: 'SAME' },
        targetData: { name: 'SAME' },
        sourceUpdatedAt: t('2026-01-03'),
        targetUpdatedAt: t('2026-01-03'),
        lastSyncedAt: t('2026-01-02'),
      }),
    ).toBe(false);
  });
});

describe('resolveConflict', () => {
  const newer = t('2026-01-05');
  const older = t('2026-01-01');

  it('source_wins / target_wins are unconditional', () => {
    expect(resolveConflict('source_wins', older, newer)).toBe('source');
    expect(resolveConflict('target_wins', newer, older)).toBe('target');
  });

  it('newest_wins compares timestamps', () => {
    expect(resolveConflict('newest_wins', newer, older)).toBe('source');
    expect(resolveConflict('newest_wins', older, newer)).toBe('target');
  });
});
