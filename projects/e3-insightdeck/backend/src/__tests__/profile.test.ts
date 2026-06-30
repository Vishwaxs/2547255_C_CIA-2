import { profileColumn } from '../engine/profile';

describe('profileColumn', () => {
  it('profiles numeric columns', () => {
    const p = profileColumn(['10', '20', '30', ''], 'numeric');
    expect(p.nullCount).toBe(1);
    expect(p.distinctCount).toBe(3);
    expect((p.stats as { min: number; max: number; mean: number }).min).toBe(10);
    expect((p.stats as { max: number }).max).toBe(30);
    expect((p.stats as { mean: number }).mean).toBe(20);
  });
  it('profiles categorical columns with top values', () => {
    const p = profileColumn(['a', 'a', 'b', 'a', 'c'], 'categorical');
    const top = (p.stats as { topValues: { value: string; count: number }[] }).topValues;
    expect(top[0]).toEqual({ value: 'a', count: 3 });
  });
  it('profiles boolean columns', () => {
    const p = profileColumn(['true', 'false', 'true'], 'boolean');
    expect(p.stats).toEqual({ trueCount: 2, falseCount: 1 });
  });
  it('profiles datetime columns with a range', () => {
    const p = profileColumn(['2026-01-01', '2026-06-01'], 'datetime');
    const s = p.stats as { min: string; max: string };
    expect(s.min).toContain('2026-01-01');
    expect(s.max).toContain('2026-06-01');
  });
});
