// The demo world.
//
// The tickets are not decoration — each one is chosen to drive the agent down a different
// branch, so a reviewer clicking through sees every outcome the planner can produce
// without having to invent test data. Five tickets, five distinct outcomes:
//
//   1. answered_from_kb  — the KB covers it, the agent answers from the article
//   2. refund_issued     — a real refundable order exists, the agent moves money
//   3. no_order_found    — refund asked for, no orders on file, agent refuses and hands off
//   4. no_kb_coverage    — question the KB cannot answer, agent refuses to improvise
//   5. refund_failed     — the only order is already refunded, the idempotency guard fires
//
// The sixth outcome, budget_exceeded, is unreachable by the rule-based planner (its longest
// path is 3 steps against a budget of 6) and is proven by a unit test with a stub planner
// that never terminates, rather than by faking a ticket that cannot really occur.

export interface SeedArticle {
  title: string;
  body: string;
  tags: string[];
}

export interface SeedOrder {
  customerId: string;
  product: string;
  amount: number;
  status: 'placed' | 'refunded';
}

export interface SeedTicket {
  customerId: string;
  subject: string;
  body: string;
  /** Documented here so the seed doubles as an executable spec of the planner's branches. */
  expects: string;
}

export const SEED_ARTICLES: SeedArticle[] = [
  {
    title: 'Resetting your password',
    body: 'Open Settings, choose Security, then select Reset password. We email a reset link to the address on your account and it stays valid for 30 minutes. If the email has not arrived after a few minutes, check your spam folder before requesting another link, because each new request invalidates the previous one.',
    tags: ['password', 'reset', 'login', 'security', 'account'],
  },
  {
    title: 'Shipping times and order tracking',
    body: 'Standard delivery arrives in 3-5 business days and express delivery in 1-2. A tracking link is emailed the moment your parcel leaves our warehouse, and the same link is always available under Orders in your account. Tracking can take up to 24 hours to show its first scan.',
    tags: ['shipping', 'delivery', 'tracking', 'order', 'parcel'],
  },
  {
    title: 'Our refund policy',
    body: 'Orders can be refunded within 30 days of purchase for any reason. Refunds return to the original payment method and clear in 5-7 business days depending on your bank. A refunded order cannot be reinstated, so if you still want the item you will need to place a new order.',
    tags: ['refund', 'return', 'policy', 'payment', 'money'],
  },
  {
    title: 'Changing your subscription plan',
    body: 'You can move between plans at any time from Billing, then Plan. Upgrades take effect immediately and we charge a prorated amount for the remainder of the current period. Downgrades take effect at the start of your next billing cycle so you keep what you have already paid for.',
    tags: ['subscription', 'plan', 'billing', 'upgrade', 'downgrade'],
  },
  {
    title: 'Updating the email address on your account',
    body: 'Go to Settings, then Account, and edit your email address. We send a confirmation link to the new address and the change only takes effect once you click it. Until then, sign-in and all notifications continue to use your old address.',
    tags: ['email', 'account', 'settings', 'address'],
  },
];

export const SEED_ORDERS: SeedOrder[] = [
  { customerId: 'cust-101', product: 'Wireless mouse', amount: 29.99, status: 'placed' },
  { customerId: 'cust-101', product: 'USB-C cable', amount: 12.5, status: 'refunded' },
  { customerId: 'cust-202', product: 'Mechanical keyboard', amount: 89.99, status: 'placed' },
  { customerId: 'cust-202', product: 'Laptop stand', amount: 45.0, status: 'placed' },
  // The whole account is already refunded — this is what makes ticket 5 hit the guard.
  { customerId: 'cust-505', product: 'Noise-cancelling headphones', amount: 199.0, status: 'refunded' },
];

export const SEED_TICKETS: SeedTicket[] = [
  {
    customerId: 'cust-101',
    subject: 'Forgot my password',
    body: "I can't remember my password and the login page keeps rejecting me. How do I reset it?",
    expects: 'search_kb -> respond (answered_from_kb)',
  },
  {
    customerId: 'cust-202',
    subject: 'Refund for my keyboard',
    body: 'The mechanical keyboard I ordered arrived with three dead keys. I would like a refund please.',
    expects: 'lookup_order -> issue_refund -> respond (refund_issued)',
  },
  {
    customerId: 'cust-303',
    subject: 'I want my money back',
    body: 'Please refund my last order. It never turned up and I have waited long enough.',
    expects: 'lookup_order -> escalate (no_order_found)',
  },
  {
    customerId: 'cust-404',
    subject: 'Do you offer student internships?',
    body: 'I am a computer science student and I wondered whether your company takes on remote interns.',
    expects: 'search_kb -> escalate (no_kb_coverage)',
  },
  {
    customerId: 'cust-505',
    subject: 'Refund my headphones again',
    body: 'I asked for a refund on my headphones last week and I want to make sure it went through, please refund them.',
    expects: 'lookup_order -> issue_refund (rejected) -> escalate (refund_failed)',
  },
];
