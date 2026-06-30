import { inferColumnType, toNumber, toBoolean, toDate, coerce } from '../engine/infer';

describe('coercion', () => {
  it('toNumber parses numbers (with thousands separators), null otherwise', () => {
    expect(toNumber('42')).toBe(42);
    expect(toNumber('1,250')).toBe(1250);
    expect(toNumber('-3.5')).toBe(-3.5);
    expect(toNumber('abc')).toBeNull();
    expect(toNumber('')).toBeNull();
  });
  it('toBoolean maps true/false tokens only', () => {
    expect(toBoolean('yes')).toBe(true);
    expect(toBoolean('FALSE')).toBe(false);
    expect(toBoolean('1')).toBeNull(); // 0/1 stays numeric
    expect(toBoolean('maybe')).toBeNull();
  });
  it('toDate parses date-ish strings but not bare numbers', () => {
    expect(toDate('2026-01-15')).toBeInstanceOf(Date);
    expect(toDate('2026')).toBeNull();
    expect(toDate('hello')).toBeNull();
  });
});

describe('inferColumnType', () => {
  it('detects numeric', () => {
    expect(inferColumnType(['1', '2', '3.5', '4'])).toBe('numeric');
  });
  it('keeps 0/1 numeric, not boolean', () => {
    expect(inferColumnType(['0', '1', '1', '0'])).toBe('numeric');
  });
  it('detects boolean from true/false tokens', () => {
    expect(inferColumnType(['true', 'false', 'true'])).toBe('boolean');
  });
  it('detects datetime', () => {
    expect(inferColumnType(['2026-01-01', '2026-02-01', '2026-03-01'])).toBe('datetime');
  });
  it('detects categorical for low-cardinality strings', () => {
    expect(inferColumnType(['North', 'South', 'North', 'East', 'North'])).toBe('categorical');
  });
  it('detects text for high-cardinality free text', () => {
    const vals = Array.from({ length: 40 }, (_, i) => `unique sentence number ${i} here`);
    expect(inferColumnType(vals)).toBe('text');
  });
  it('coerce returns typed values', () => {
    expect(coerce('5', 'numeric')).toBe(5);
    expect(coerce('', 'numeric')).toBeNull();
    expect(coerce('North', 'categorical')).toBe('North');
  });
});
