import { Clause, matchRule } from './clause';
import { bucket, assignVariant, WeightedVariation } from './bucket';

export interface Variation {
  key: string;
  value: unknown;
}

// How a flag/rule serves: either a fixed variation, or a weighted rollout.
export interface Serve {
  variationKey?: string;
  rollout?: WeightedVariation[];
}

export interface EvalRule {
  order: number;
  conditions: Clause[];
  serve: Serve;
}

export interface FlagConfig {
  key: string;
  enabled: boolean;
  variations: Variation[];
  fallthrough: Serve;
  offVariationKey: string;
  rules: EvalRule[];
}

export interface EvalContext {
  unitKey: string;
  attributes: Record<string, unknown>;
}

export interface EvalResult {
  variationKey: string;
  value: unknown;
  reason: string; // flag_off | rule_match:N | fallthrough
  ruleOrder: number | null;
}

function resolveServe(flag: FlagConfig, serve: Serve, ctx: EvalContext): string {
  if (serve.variationKey) return serve.variationKey;
  if (serve.rollout && serve.rollout.length > 0) {
    return assignVariant(serve.rollout, bucket(flag.key, ctx.unitKey));
  }
  // malformed serve — fall back to the off variation so evaluation is always total
  return flag.offVariationKey;
}

// Evaluate a flag for a context. Pure and total: an off flag serves its off variation; the
// first matching rule (in order) serves its variation/rollout; otherwise the fallthrough.
// Every result carries a reason for debuggability.
export function evaluate(flag: FlagConfig, ctx: EvalContext): EvalResult {
  const valueOf = (key: string): unknown => flag.variations.find((v) => v.key === key)?.value;

  if (!flag.enabled) {
    return { variationKey: flag.offVariationKey, value: valueOf(flag.offVariationKey), reason: 'flag_off', ruleOrder: null };
  }

  const ordered = [...flag.rules].sort((a, b) => a.order - b.order);
  for (const rule of ordered) {
    if (matchRule(rule.conditions, ctx.attributes)) {
      const vk = resolveServe(flag, rule.serve, ctx);
      return { variationKey: vk, value: valueOf(vk), reason: `rule_match:${rule.order}`, ruleOrder: rule.order };
    }
  }

  const vk = resolveServe(flag, flag.fallthrough, ctx);
  return { variationKey: vk, value: valueOf(vk), reason: 'fallthrough', ruleOrder: null };
}
