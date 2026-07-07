import { hashToUnit, bucket, assignVariant } from '../engine/bucket';

describe('hashToUnit / bucket determinism', () => {
  it('is deterministic and in range [0,100)', () => {
    const a = bucket('flag-x', 'user-1');
    const b = bucket('flag-x', 'user-1');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });

  it('different flags bucket the same unit differently (salted by flag key)', () => {
    // Not guaranteed for every pair, but overwhelmingly likely for these fixed inputs.
    expect(bucket('flag-a', 'user-1')).not.toBe(bucket('flag-b', 'user-1'));
  });

  it('hashToUnit stays within [0,1)', () => {
    for (const k of ['a', 'b', 'user-42', 'zzz']) {
      const u = hashToUnit(k);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });
});

describe('assignVariant weighted split', () => {
  const rollout = [
    { variationKey: 'control', weight: 50 },
    { variationKey: 'treatment', weight: 50 },
  ];

  it('picks control below the midpoint and treatment above', () => {
    expect(assignVariant(rollout, 10)).toBe('control');
    expect(assignVariant(rollout, 49.9)).toBe('control');
    expect(assignVariant(rollout, 50)).toBe('treatment');
    expect(assignVariant(rollout, 99)).toBe('treatment');
  });

  it('normalizes arbitrary weights', () => {
    const r = [
      { variationKey: 'a', weight: 1 },
      { variationKey: 'b', weight: 3 },
    ];
    expect(assignVariant(r, 24)).toBe('a'); // a owns [0,25)
    expect(assignVariant(r, 26)).toBe('b');
  });

  it('distributes ~50/50 over many units (statistical sanity)', () => {
    let control = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      if (assignVariant(rollout, bucket('exp-flag', `user-${i}`)) === 'control') control++;
    }
    const share = control / N;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });
});
