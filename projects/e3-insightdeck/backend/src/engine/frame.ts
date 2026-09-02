import { ColumnType, coerce } from './infer';

// A typed, column-oriented view over a dataset's raw rows. Detectors operate on this
// instead of re-coercing strings, so the type system is applied once, centrally.
export interface ColumnView {
  name: string;
  type: ColumnType;
  raw: string[];
  values: (number | boolean | Date | string | null)[];
}

export interface Frame {
  rowCount: number;
  columns: ColumnView[];
  byName: Map<string, ColumnView>;
  numeric: ColumnView[];
  categorical: ColumnView[];
  datetime: ColumnView[];
}

export function buildFrame(
  rows: Record<string, string>[],
  cols: { name: string; inferredType: string }[],
): Frame {
  const columns: ColumnView[] = cols.map((c) => {
    const type = c.inferredType as ColumnType;
    const raw = rows.map((r) => r[c.name] ?? '');
    return { name: c.name, type, raw, values: raw.map((v) => coerce(v, type)) };
  });
  return {
    rowCount: rows.length,
    columns,
    byName: new Map(columns.map((c) => [c.name, c])),
    numeric: columns.filter((c) => c.type === 'numeric'),
    categorical: columns.filter((c) => c.type === 'categorical'),
    datetime: columns.filter((c) => c.type === 'datetime'),
  };
}
