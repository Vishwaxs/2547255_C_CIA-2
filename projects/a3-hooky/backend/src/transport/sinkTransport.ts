import { DeliveryTransport, SendContext, SendResult } from './transport';

// Offline, deterministic delivery target. The subscription's `mode` decides the outcome so
// retry / backoff / dead-letter / replay can all be demonstrated and tested without any
// network: ok always succeeds, fail always 500s, flaky fails until the 3rd attempt, slow
// simulates a timeout.
export class SinkTransport implements DeliveryTransport {
  readonly kind = 'sink';

  async send(ctx: SendContext): Promise<SendResult> {
    switch (ctx.mode) {
      case 'fail':
        return { ok: false, statusCode: 500, error: 'sink: endpoint always fails', durationMs: 1 };
      case 'flaky':
        if (ctx.attempt < 3) {
          return { ok: false, statusCode: 503, error: `sink: flaky (attempt ${ctx.attempt})`, durationMs: 1 };
        }
        return { ok: true, statusCode: 200, durationMs: 1 };
      case 'slow':
        return { ok: false, error: 'sink: request timed out', durationMs: 1 };
      case 'ok':
      default:
        return { ok: true, statusCode: 200, durationMs: 1 };
    }
  }
}
