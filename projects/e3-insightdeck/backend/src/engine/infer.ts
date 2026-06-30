// Column type inference + value coercion. Pure, no deps.

export type ColumnType = 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text';

const TRUE_TOKENS = new Set(['true', 't', 'yes', 'y']);
const FALSE_TOKENS = new Set(['false', 'f', 'no', 'n']);

export function isBlank(v: string): boolean {
  return v === undefined || v === null || v.trim() === '';
}

export function toNumber(v: string): number | null {
  if (isBlank(v)) return null;
  const cleaned = v.replace(/,/g, ''); // tolerate thousands separators
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function toBoolean(v: string): boolean | null {
  if (isBlank(v)) return null;
  const t = v.trim().toLowerCase();
  if (TRUE_TOKENS.has(t)) return true;
  if (FALSE_TOKENS.has(t)) return false;
  return null;
}

export function toDate(v: string): Date | null {
  if (isBlank(v)) return null;
  // Require a date-ish separator and reject plain numbers so years/counts aren't dates.
  if (!/[-/:]/.test(v) || Number.isFinite(Number(v.replace(/,/g, '')))) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}

function ratio(values: string[], pred: (v: string) => boolean): number {
  const nonBlank = values.filter((v) => !isBlank(v));
  if (nonBlank.length === 0) return 0;
  return nonBlank.filter(pred).length / nonBlank.length;
}

// Infer a column's type from its raw string values. Order matters: booleans are only
// explicit true/false tokens (so 0/1 stays numeric); numeric beats datetime (so a bare
// year is a number); categorical vs text is decided by distinct-value ratio.
export function inferColumnType(values: string[]): ColumnType {
  const nonBlank = values.filter((v) => !isBlank(v));
  if (nonBlank.length === 0) return 'text';

  const distinct = new Set(nonBlank.map((v) => v.toLowerCase()));
  if (distinct.size <= 2 && ratio(values, (v) => toBoolean(v) !== null) >= 0.99) {
    return 'boolean';
  }
  if (ratio(values, (v) => toNumber(v) !== null) >= 0.9) return 'numeric';
  if (ratio(values, (v) => toDate(v) !== null) >= 0.9) return 'datetime';

  const distinctRatio = distinct.size / nonBlank.length;
  if (distinct.size <= 30 || distinctRatio <= 0.5) return 'categorical';
  return 'text';
}

// Coerce a raw value to its typed representation (or null when blank/unparseable).
export function coerce(v: string, type: ColumnType): number | boolean | Date | string | null {
  if (isBlank(v)) return null;
  switch (type) {
    case 'numeric':
      return toNumber(v);
    case 'boolean':
      return toBoolean(v);
    case 'datetime':
      return toDate(v);
    default:
      return v;
  }
}
