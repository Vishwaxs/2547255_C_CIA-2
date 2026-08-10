import { Planner, PlannerContext, PlannerDecision, AgentStepLike, PlannerTicket } from './types';
import { classifyIntent } from './intent';

// The deterministic brain.
//
// It reads exactly what an LLM planner would read — the ticket plus every prior
// Thought/Action/Observation — and returns exactly what an LLM planner would return: one
// decision, one step at a time. It never sees the database. The only way it can learn
// anything about the world is to pick a tool and read the observation the loop hands back
// on the next call. That constraint is what keeps the two implementations swappable.
//
// The state machine is driven by *what has already been observed*, not by a step counter,
// so a resumed run picks up correctly from persisted history without any extra bookkeeping.

function lastObservation(steps: AgentStepLike[], action: string) {
  return [...steps].reverse().find((s) => s.action === action)?.observation;
}

interface OrderView {
  id: string;
  product: string;
  amount: number;
  status: string;
}

interface ArticleView {
  id: string;
  title: string;
  score: number;
  snippet: string;
  matchedTerms: string[];
}

export class RuleBasedPlanner implements Planner {
  readonly kind = 'rule_based';

  decide(ctx: PlannerContext): PlannerDecision {
    return classifyIntent(ctx.ticket) === 'refund'
      ? this.decideRefund(ctx.ticket, ctx.steps)
      : this.decideQuestion(ctx.ticket, ctx.steps);
  }

  /** Refund path: establish the facts, act, confirm. Escalate the moment the facts don't
   *  support acting autonomously — an agent that can move money has to fail closed. */
  private decideRefund(ticket: PlannerTicket, steps: AgentStepLike[]): PlannerDecision {
    const lookup = lastObservation(steps, 'lookup_order');

    if (!lookup) {
      return {
        thought:
          "This reads as a refund request. I can't act on it until I know what this customer actually bought, so the first move is to pull their order history.",
        action: 'lookup_order',
        actionInput: { customerId: ticket.customerId },
      };
    }

    const orders = (lookup.data.orders as OrderView[] | undefined) ?? [];
    if (!lookup.ok || orders.length === 0) {
      return {
        thought:
          'There are no orders on file for this customer, so there is nothing I can legitimately refund. Guessing here would be worse than handing off, so I am escalating.',
        action: 'escalate',
        actionInput: {
          reason: 'no_order_found',
          detail: `No orders on file for ${ticket.customerId}. A human needs to verify the purchase before any refund.`,
        },
      };
    }

    const refund = lastObservation(steps, 'issue_refund');

    if (!refund) {
      const target = orders.find((o) => o.status === 'placed');
      if (!target) {
        return {
          thought:
            'Every order on this account has already been refunded, so there is nothing left for me to act on. A human should look at why the customer is asking again.',
          action: 'escalate',
          actionInput: {
            reason: 'refund_failed',
            detail: 'All orders for this customer are already refunded.',
          },
        };
      }
      return {
        thought: `Order ${target.id} (${target.product}, $${target.amount.toFixed(2)}) is still in "placed" status, which makes it the refundable one. Issuing the refund against it.`,
        action: 'issue_refund',
        actionInput: { orderId: target.id },
      };
    }

    if (refund.ok) {
      const amount = Number(refund.data.amount ?? 0);
      const product = String(refund.data.product ?? 'your order');
      const orderId = String(refund.data.orderId ?? '');
      return {
        thought: 'The refund went through and I have the confirmed amount back from the tool, so I can close this out with the customer.',
        action: 'respond',
        actionInput: {
          outcome: 'refund_issued',
          message: `Your refund of $${amount.toFixed(2)} for ${product} has been processed. It will appear on your original payment method within 5-7 business days.`,
          orderId,
        },
      };
    }

    // The tool refused — most often the idempotency guard catching a double refund.
    return {
      thought: `The refund did not go through (${refund.summary}) I am not going to retry a money movement I do not understand, so this goes to a human.`,
      action: 'escalate',
      actionInput: { reason: 'refund_failed', detail: refund.summary },
    };
  }

  /** Question path: search, then answer only from what was actually found. */
  private decideQuestion(ticket: PlannerTicket, steps: AgentStepLike[]): PlannerDecision {
    const search = lastObservation(steps, 'search_kb');

    if (!search) {
      return {
        thought:
          'This is a general question rather than a refund. Before answering anything I should check whether our knowledge base already covers it.',
        action: 'search_kb',
        actionInput: { query: `${ticket.subject} ${ticket.body}` },
      };
    }

    const results = (search.data.results as ArticleView[] | undefined) ?? [];
    if (!search.ok || results.length === 0) {
      // A weak candidate is worth naming in the trace. "I found nothing" and "I found
      // something and judged it too thin to answer from" are different pieces of
      // reasoning, and the second is the one worth being able to point at later.
      const rejected = (search.data.rejected as ArticleView[] | undefined) ?? [];
      const thought = rejected.length
        ? `The closest article, "${rejected[0].title}", only matched on ${rejected[0].matchedTerms.join(', ')} for a score of ${rejected[0].score}. That is a coincidental overlap rather than an answer, and quoting it would be worse than saying nothing, so I am escalating.`
        : 'Nothing in the knowledge base covers this. Answering from thin air is exactly the failure mode worth avoiding, so I am escalating instead of improvising.';
      return {
        thought,
        action: 'escalate',
        actionInput: {
          reason: 'no_kb_coverage',
          detail: rejected.length
            ? `No article cleared the confidence bar; best candidate "${rejected[0].title}" scored ${rejected[0].score}. Routing to a human agent.`
            : 'No knowledge base article matched this question; routing to a human agent.',
        },
      };
    }

    const top = results[0];
    return {
      thought: `"${top.title}" matched on ${top.matchedTerms.join(', ')} and scored ${top.score}, which is a strong enough match to answer from directly rather than escalate.`,
      action: 'respond',
      actionInput: {
        outcome: 'answered_from_kb',
        message: `${top.snippet}\n\n— from our help centre article "${top.title}"`,
        articleId: top.id,
      },
    };
  }
}
