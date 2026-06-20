// Declarative field-mapping engine. Each FieldMapping rule reads one field
// from the source record, runs it through a named transform, and writes it to a
// target field. Pure and dependency-free, so it is trivially unit-testable.

export const TRANSFORMS = [
  'none',
  'uppercase',
  'lowercase',
  'trim',
  'number',
  'date_iso',
] as const;

export type TransformName = (typeof TRANSFORMS)[number];

export interface MappingRule {
  sourceField: string;
  targetField: string;
  transform: TransformName;
}

const transformRegistry: Record<TransformName, (value: unknown) => unknown> = {
  none: (v) => v,
  uppercase: (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  lowercase: (v) => (typeof v === 'string' ? v.toLowerCase() : v),
  trim: (v) => (typeof v === 'string' ? v.trim() : v),
  number: (v) => {
    if (typeof v === 'number') return v;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  },
  date_iso: (v) => {
    if (v == null) return null;
    const d = new Date(v as string | number);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  },
};

export function applyTransform(name: TransformName, value: unknown): unknown {
  const fn = transformRegistry[name] ?? transformRegistry.none;
  return fn(value);
}

// Apply every mapping rule to a source record, producing the target payload.
// Fields absent from the source are skipped (not written as undefined).
export function applyMappings(
  source: Record<string, unknown>,
  rules: MappingRule[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const rule of rules) {
    if (!(rule.sourceField in source)) continue;
    out[rule.targetField] = applyTransform(rule.transform, source[rule.sourceField]);
  }
  return out;
}
