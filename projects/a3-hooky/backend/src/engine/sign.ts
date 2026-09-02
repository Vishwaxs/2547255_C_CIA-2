import crypto from 'crypto';

// HMAC-SHA256 request signing (Stripe/GitHub-webhook style). The signature covers
// `${timestamp}.${payload}` so a captured body can't be replayed under a new timestamp.
export function sign(secret: string, payload: string, timestamp: number): string {
  const mac = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `sha256=${mac}`;
}

// Constant-time verification (what a receiver would run).
export function verify(secret: string, payload: string, timestamp: number, signature: string): boolean {
  const expected = sign(secret, payload, timestamp);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// The headers Hooky sends with every delivery.
export function signedHeaders(opts: {
  deliveryId: string;
  eventType: string;
  secret: string;
  payload: string;
  timestamp: number;
}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Hooky-Id': opts.deliveryId,
    'X-Hooky-Event': opts.eventType,
    'X-Hooky-Timestamp': String(opts.timestamp),
    'X-Hooky-Signature': sign(opts.secret, opts.payload, opts.timestamp),
  };
}

export function generateSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}
