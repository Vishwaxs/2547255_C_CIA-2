import { matchClause, matchRule, Clause } from '../engine/clause';

describe('matchClause', () => {
  const attrs = { country: 'US', plan: 'pro', age: 30, email: 'a@b.com' };

  it('eq / neq', () => {
    expect(matchClause({ attribute: 'country', op: 'eq', values: ['US'] }, attrs)).toBe(true);
    expect(matchClause({ attribute: 'country', op: 'eq', values: ['CA'] }, attrs)).toBe(false);
    expect(matchClause({ attribute: 'country', op: 'neq', values: ['CA'] }, attrs)).toBe(true);
  });

  it('in / notIn', () => {
    expect(matchClause({ attribute: 'country', op: 'in', values: ['US', 'CA'] }, attrs)).toBe(true);
    expect(matchClause({ attribute: 'country', op: 'in', values: ['GB'] }, attrs)).toBe(false);
    expect(matchClause({ attribute: 'country', op: 'notIn', values: ['GB'] }, attrs)).toBe(true);
  });

  it('contains / startsWith', () => {
    expect(matchClause({ attribute: 'email', op: 'contains', values: ['@b'] }, attrs)).toBe(true);
    expect(matchClause({ attribute: 'email', op: 'startsWith', values: ['a@'] }, attrs)).toBe(true);
    expect(matchClause({ attribute: 'email', op: 'startsWith', values: ['z'] }, attrs)).toBe(false);
  });

  it('numeric comparisons', () => {
    expect(matchClause({ attribute: 'age', op: 'gt', values: [18] }, attrs)).toBe(true);
    expect(matchClause({ attribute: 'age', op: 'gte', values: [30] }, attrs)).toBe(true);
    expect(matchClause({ attribute: 'age', op: 'lt', values: [30] }, attrs)).toBe(false);
    expect(matchClause({ attribute: 'age', op: 'lte', values: [30] }, attrs)).toBe(true);
  });

  it('exists is true only when the attribute is present and non-null', () => {
    expect(matchClause({ attribute: 'plan', op: 'exists', values: [] }, attrs)).toBe(true);
    expect(matchClause({ attribute: 'missing', op: 'exists', values: [] }, attrs)).toBe(false);
    expect(matchClause({ attribute: 'nul', op: 'exists', values: [] }, { nul: null })).toBe(false);
  });
});

describe('matchRule (AND of clauses)', () => {
  const attrs = { country: 'US', plan: 'pro' };
  it('matches only when every clause matches', () => {
    const both: Clause[] = [
      { attribute: 'country', op: 'eq', values: ['US'] },
      { attribute: 'plan', op: 'eq', values: ['pro'] },
    ];
    expect(matchRule(both, attrs)).toBe(true);
    expect(matchRule([...both, { attribute: 'plan', op: 'eq', values: ['free'] }], attrs)).toBe(false);
  });
  it('an empty clause list is a catch-all (matches everyone)', () => {
    expect(matchRule([], attrs)).toBe(true);
  });
});
