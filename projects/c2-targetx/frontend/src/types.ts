export interface Variation { key: string; value: unknown }
export interface WeightedVariation { variationKey: string; weight: number }
export interface Serve { variationKey?: string; rollout?: WeightedVariation[] }
export interface Condition { attribute: string; op: string; values: unknown[] }
export interface Rule { id: string; order: number; description?: string; conditions: Condition[]; serve: Serve }

export interface FlagListItem {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  variations: Variation[];
  fallthrough: Serve;
  offVariationKey: string;
  _count?: { rules: number };
}
export interface FlagDetail extends FlagListItem {
  rules: Rule[];
}

export interface EvalResult {
  flagKey: string;
  variationKey: string;
  value: unknown;
  reason: string;
  ruleOrder: number | null;
}

export interface Stats {
  flag: string;
  totalExposures: number;
  byVariation: { variationKey: string; count: number; share: number }[];
  byReason: { reason: string; count: number }[];
}

export const OPS = ['eq', 'neq', 'in', 'notIn', 'contains', 'startsWith', 'gt', 'gte', 'lt', 'lte', 'exists'];
