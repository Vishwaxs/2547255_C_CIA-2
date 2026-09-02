import { Tool, ToolResult } from '../types';
import { prisma } from '../../lib/prisma';

export const issueRefundTool: Tool = {
  name: 'issue_refund',
  description: 'Refund a single order by id. Idempotent — refuses an order that is already refunded. Input: { orderId: string }',
  async run(input): Promise<ToolResult> {
    const orderId = String(input.orderId ?? '').trim();
    if (!orderId) {
      return { ok: false, summary: 'No orderId supplied to issue_refund.', data: {} };
    }

    // This is the only tool that mutates anything, so it is the only one that needs to be
    // safe against being run twice. The guard and the update are done in one transaction
    // with a status precondition on the update, so two concurrent runs cannot both refund
    // the same order — the second updates 0 rows and reports the conflict honestly rather
    // than double-refunding and reporting success.
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) return { kind: 'missing' as const };
      if (order.status === 'refunded') return { kind: 'already' as const, order };

      const updated = await tx.order.updateMany({
        where: { id: orderId, status: 'placed' },
        data: { status: 'refunded', refundedAt: new Date() },
      });
      if (updated.count === 0) return { kind: 'already' as const, order };

      const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      return { kind: 'refunded' as const, order: fresh };
    });

    if (result.kind === 'missing') {
      return { ok: false, summary: `Order ${orderId} does not exist.`, data: { orderId } };
    }
    if (result.kind === 'already') {
      return {
        ok: false,
        summary: `Order ${orderId} was already refunded — refusing to refund it twice.`,
        data: { orderId, status: 'refunded', product: result.order.product },
      };
    }

    return {
      ok: true,
      summary: `Refunded ${result.order.product} — $${result.order.amount.toFixed(2)}.`,
      data: {
        orderId,
        product: result.order.product,
        amount: result.order.amount,
        status: result.order.status,
      },
    };
  },
};
