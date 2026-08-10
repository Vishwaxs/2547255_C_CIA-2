// Ticket intent classification. Pure, synchronous, and trivially testable.
//
// This is the one place a real LLM planner would obviously do better, and that is the
// point: the rule-based planner keeps intent detection narrow and legible so its failure
// modes are obvious. It recognizes a refund request or it doesn't; there is no confidence
// score to launder a guess through.

export type Intent = 'refund' | 'question';

// Word-boundary anchored so "refundable" in a knowledge-base quote can't trip it, and
// multi-word forms are matched explicitly rather than by loose keyword soup.
const REFUND_RE =
  /\b(refund(?:ed|ing)?|money\s?back|charge\s?back|reimburse(?:ment)?|return\s+my\s+(?:money|payment|order|purchase))\b/i;

export function classifyIntent(ticket: { subject: string; body: string }): Intent {
  return REFUND_RE.test(`${ticket.subject} ${ticket.body}`) ? 'refund' : 'question';
}
