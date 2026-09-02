// Ticket intent classification. Pure, synchronous, and trivially testable.
//
// This routes a ticket to one of two branches, and the branches are not symmetric: the
// refund branch can MOVE MONEY, the question branch can only read. So the classifier is
// deliberately biased — it fails closed, routing to `refund` only on an explicit request
// and treating everything else, including talk *about* refunds, as a question.
//
// That asymmetry was learned the hard way. An earlier version matched the bare word
// "refund" anywhere in the ticket, which meant "What is your refund policy?" — a question
// from someone who had not even decided to buy yet — was classified as a refund request,
// went straight to lookup_order, found a perfectly good order, and refunded it. Mentioning
// a refund is not the same as asking for one, and the cost of confusing the two is
// asymmetric: mis-routing a real request means one extra escalation, while mis-routing a
// question means taking money movement on a customer who never asked.

export type Intent = 'refund' | 'question';

// Explicit request forms only. Each alternative requires a requesting context — an
// imperative ("refund my order"), a first-person want ("I would like a refund"), or a
// phrase that is only ever a demand ("money back", "chargeback").
const REFUND_REQUEST = new RegExp(
  [
    // The customer points at something of their own: "refund my order",
    // "refund for my keyboard", "refund it", "my refund".
    'refund\\s+(?:for\\s+|on\\s+)?(?:my|our|this|that|the|it|them|these|those)\\b',
    '\\b(?:my|our)\\s+refund\\b',
    // Imperative politeness in either order.
    'please\\s+refund',
    'refund\\s+please',
    // First-person desire aimed at a refund, within one sentence.
    "(?:i|we)\\s+(?:want|need|would\\s+like|'d\\s+like|am\\s+requesting|request)\\b[^.?!]{0,60}?\\b(?:refund|money\\s?back|reimbursement)\\b",
    // Phrases that are only ever demands, never neutral questions.
    '\\bmoney\\s?back\\b',
    '\\bcharge\\s?back\\b',
    'reimburse\\s+(?:me|us)\\b',
    'return\\s+my\\s+(?:money|payment|purchase|order)\\b',
  ].join('|'),
  'i',
);

export function classifyIntent(ticket: { subject: string; body: string }): Intent {
  return REFUND_REQUEST.test(`${ticket.subject} ${ticket.body}`) ? 'refund' : 'question';
}
