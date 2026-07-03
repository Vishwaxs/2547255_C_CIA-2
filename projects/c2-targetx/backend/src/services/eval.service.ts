import { prisma } from '../lib/prisma';
import { evaluate, EvalContext, EvalResult } from '../engine/evaluate';
import { toConfig } from './flag.service';
import { HttpError } from '../middleware/errorHandler';

// Log one exposure per evaluation (the raw data behind experiment analytics). Fail-open —
// a logging error never fails the evaluation. A production build would batch/sample these.
async function logExposure(flagId: string, unitKey: string, r: EvalResult): Promise<void> {
  await prisma.exposure
    .create({
      data: { flagId, unitKey, variationKey: r.variationKey, reason: r.reason, ruleOrder: r.ruleOrder },
    })
    .catch(() => undefined);
}

export async function evaluateFlag(key: string, ctx: EvalContext): Promise<EvalResult & { flagKey: string }> {
  const flag = await prisma.flag.findUnique({ where: { key }, include: { rules: { orderBy: { order: 'asc' } } } });
  if (!flag) throw new HttpError(404, 'Flag not found');
  const result = evaluate(toConfig(flag), ctx);
  await logExposure(flag.id, ctx.unitKey, result);
  return { flagKey: key, ...result };
}

// SDK-style: evaluate every flag for one context (what a client "identify" call returns).
export async function evaluateAll(ctx: EvalContext): Promise<Record<string, { variationKey: string; value: unknown; reason: string }>> {
  const flags = await prisma.flag.findMany({ include: { rules: { orderBy: { order: 'asc' } } } });
  const out: Record<string, { variationKey: string; value: unknown; reason: string }> = {};
  for (const flag of flags) {
    const r = evaluate(toConfig(flag), ctx);
    await logExposure(flag.id, ctx.unitKey, r);
    out[flag.key] = { variationKey: r.variationKey, value: r.value, reason: r.reason };
  }
  return out;
}
