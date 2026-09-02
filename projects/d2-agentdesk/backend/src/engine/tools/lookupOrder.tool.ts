import { Tool, ToolResult } from '../types';
import { prisma } from '../../lib/prisma';

export const lookupOrderTool: Tool = {
  name: 'lookup_order',
  description: "Look up every order belonging to a customer, newest first. Input: { customerId: string }",
  async run(input): Promise<ToolResult> {
    const customerId = String(input.customerId ?? '').trim();
    if (!customerId) {
      return { ok: false, summary: 'No customerId supplied to lookup_order.', data: { orders: [] } };
    }

    const orders = await prisma.order.findMany({
      where: { customerId },
      orderBy: { placedAt: 'desc' },
    });

    if (orders.length === 0) {
      // ok:false is deliberate. "This customer has no orders" is not a neutral empty
      // list to the agent — it is the fact that makes an autonomous refund impossible
      // and forces a handoff to a human.
      return {
        ok: false,
        summary: `No orders on file for customer ${customerId}.`,
        data: { orders: [], customerId },
      };
    }

    const refundable = orders.filter((o) => o.status === 'placed').length;
    return {
      ok: true,
      summary: `Found ${orders.length} order(s) for ${customerId}, ${refundable} refundable.`,
      data: {
        customerId,
        orders: orders.map((o) => ({
          id: o.id,
          product: o.product,
          amount: o.amount,
          status: o.status,
          placedAt: o.placedAt.toISOString(),
        })),
      },
    };
  },
};
