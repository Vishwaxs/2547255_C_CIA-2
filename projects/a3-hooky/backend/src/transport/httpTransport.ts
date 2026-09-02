import { DeliveryTransport, SendContext, SendResult } from './transport';

// The real drop-in: POST the signed payload to the endpoint with global fetch (Node 22).
// Not the default — there is no egress in this build, so a real POST fails fast and the
// delivery retries/dead-letters exactly as it would in production. No new dependency.
export class HttpTransport implements DeliveryTransport {
  readonly kind = 'http';

  async send(ctx: SendContext, payload: string, headers: Record<string, string>): Promise<SendResult> {
    const started = Date.now();
    try {
      const res = await fetch(ctx.url, { method: 'POST', body: payload, headers });
      return {
        ok: res.ok,
        statusCode: res.status,
        error: res.ok ? undefined : `HTTP ${res.status}`,
        durationMs: Date.now() - started,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message ?? 'network error', durationMs: Date.now() - started };
    }
  }
}
