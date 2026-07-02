// The delivery swap point. A DeliveryTransport turns a signed request into a result; the
// dispatcher depends only on this interface. The offline SinkTransport backs it here; a
// real HttpTransport (fetch) drops in unchanged.

export interface SendContext {
  url: string;
  mode: string; // subscription mode — the sink uses this to decide the outcome
  attempt: number; // 1-based
}

export interface SendResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
  durationMs: number;
}

export interface DeliveryTransport {
  readonly kind: string;
  send(ctx: SendContext, payload: string, headers: Record<string, string>): Promise<SendResult>;
}
