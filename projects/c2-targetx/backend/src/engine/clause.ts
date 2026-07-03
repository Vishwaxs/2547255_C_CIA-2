// Targeting clause matching. A clause tests one attribute of the evaluation context; a
// rule's clauses are AND-combined. Pure, no I/O.

export type Op =
  | 'eq' | 'neq' | 'in' | 'notIn'
  | 'contains' | 'startsWith'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'exists';

export interface Clause {
  attribute: string;
  op: Op;
  values: unknown[];
}

const num = (v: unknown): number => Number(v);

export function matchClause(clause: Clause, attributes: Record<string, unknown>): boolean {
  const actual = attributes[clause.attribute];
  const values = clause.values ?? [];
  const first = values[0];

  switch (clause.op) {
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'eq':
      return actual === first;
    case 'neq':
      return actual !== first;
    case 'in':
      return values.some((v) => v === actual);
    case 'notIn':
      return !values.some((v) => v === actual);
    case 'contains':
      return typeof actual === 'string' && actual.includes(String(first));
    case 'startsWith':
      return typeof actual === 'string' && actual.startsWith(String(first));
    case 'gt':
      return num(actual) > num(first);
    case 'gte':
      return num(actual) >= num(first);
    case 'lt':
      return num(actual) < num(first);
    case 'lte':
      return num(actual) <= num(first);
    default:
      return false;
  }
}

// A rule matches when every one of its clauses matches (AND). An empty clause list matches
// everyone — a catch-all rule.
export function matchRule(conditions: Clause[], attributes: Record<string, unknown>): boolean {
  return conditions.every((c) => matchClause(c, attributes));
}
