import { evaluate, FlagConfig } from '../engine/evaluate';

const boolFlag: FlagConfig = {
  key: 'new-onboarding',
  enabled: true,
  variations: [
    { key: 'on', value: true },
    { key: 'off', value: false },
  ],
  fallthrough: { variationKey: 'off' },
  offVariationKey: 'off',
  rules: [{ order: 0, conditions: [{ attribute: 'country', op: 'in', values: ['US', 'CA'] }], serve: { variationKey: 'on' } }],
};

describe('evaluate', () => {
  it('serves the off variation when the flag is disabled', () => {
    const r = evaluate({ ...boolFlag, enabled: false }, { unitKey: 'u1', attributes: { country: 'US' } });
    expect(r.variationKey).toBe('off');
    expect(r.value).toBe(false);
    expect(r.reason).toBe('flag_off');
    expect(r.ruleOrder).toBeNull();
  });

  it('serves a matching rule (targeting) with reason rule_match:N', () => {
    const r = evaluate(boolFlag, { unitKey: 'u1', attributes: { country: 'US' } });
    expect(r.variationKey).toBe('on');
    expect(r.value).toBe(true);
    expect(r.reason).toBe('rule_match:0');
    expect(r.ruleOrder).toBe(0);
  });

  it('falls through when no rule matches', () => {
    const r = evaluate(boolFlag, { unitKey: 'u1', attributes: { country: 'GB' } });
    expect(r.variationKey).toBe('off');
    expect(r.reason).toBe('fallthrough');
  });

  it('evaluates rules in order (first match wins)', () => {
    const flag: FlagConfig = {
      ...boolFlag,
      rules: [
        { order: 0, conditions: [{ attribute: 'plan', op: 'eq', values: ['pro'] }], serve: { variationKey: 'on' } },
        { order: 1, conditions: [{ attribute: 'country', op: 'eq', values: ['US'] }], serve: { variationKey: 'off' } },
      ],
    };
    const r = evaluate(flag, { unitKey: 'u1', attributes: { plan: 'pro', country: 'US' } });
    expect(r.reason).toBe('rule_match:0'); // pro rule wins over the US rule
    expect(r.variationKey).toBe('on');
  });

  it('a rollout fallthrough is deterministic per unit key', () => {
    const exp: FlagConfig = {
      key: 'pricing-page',
      enabled: true,
      variations: [
        { key: 'control', value: 'A' },
        { key: 'variant', value: 'B' },
      ],
      fallthrough: { rollout: [{ variationKey: 'control', weight: 50 }, { variationKey: 'variant', weight: 50 }] },
      offVariationKey: 'control',
      rules: [],
    };
    const first = evaluate(exp, { unitKey: 'user-777', attributes: {} });
    const again = evaluate(exp, { unitKey: 'user-777', attributes: {} });
    expect(first.variationKey).toBe(again.variationKey); // sticky
    expect(first.reason).toBe('fallthrough');
    expect(['control', 'variant']).toContain(first.variationKey);
  });
});
