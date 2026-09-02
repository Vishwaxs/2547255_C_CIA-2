import { applyMappings, applyTransform, MappingRule } from '../engine/mapping';

describe('applyTransform', () => {
  it('uppercase / lowercase / trim only touch strings', () => {
    expect(applyTransform('uppercase', 'abc')).toBe('ABC');
    expect(applyTransform('lowercase', 'ABC')).toBe('abc');
    expect(applyTransform('trim', '  hi  ')).toBe('hi');
    expect(applyTransform('uppercase', 42)).toBe(42); // non-string passthrough
  });

  it('number coerces and returns null for non-numerics', () => {
    expect(applyTransform('number', '99')).toBe(99);
    expect(applyTransform('number', 7)).toBe(7);
    expect(applyTransform('number', 'abc')).toBeNull();
  });

  it('date_iso normalizes parseable dates, null otherwise', () => {
    expect(applyTransform('date_iso', '2026-01-02')).toBe('2026-01-02T00:00:00.000Z');
    expect(applyTransform('date_iso', 'not-a-date')).toBeNull();
    expect(applyTransform('date_iso', null)).toBeNull();
  });

  it('none is identity', () => {
    expect(applyTransform('none', { a: 1 })).toEqual({ a: 1 });
  });
});

describe('applyMappings', () => {
  const rules: MappingRule[] = [
    { sourceField: 'first_name', targetField: 'First', transform: 'none' },
    { sourceField: 'last_name', targetField: 'Last', transform: 'uppercase' },
    { sourceField: 'email', targetField: 'Email', transform: 'trim' },
    { sourceField: 'score', targetField: 'Score', transform: 'number' },
  ];

  it('maps and transforms each field', () => {
    const out = applyMappings(
      { first_name: 'Ada', last_name: 'Lovelace', email: '  a@b.com  ', score: '10' },
      rules,
    );
    expect(out).toEqual({ First: 'Ada', Last: 'LOVELACE', Email: 'a@b.com', Score: 10 });
  });

  it('skips source fields that are absent (no undefined writes)', () => {
    const out = applyMappings({ first_name: 'Ada' }, rules);
    expect(out).toEqual({ First: 'Ada' });
    expect('Last' in out).toBe(false);
  });

  it('returns an empty object when no rules match', () => {
    expect(applyMappings({ unrelated: 1 }, rules)).toEqual({});
  });
});
