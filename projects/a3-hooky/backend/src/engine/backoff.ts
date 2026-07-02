// Exponential backoff for delivery retries. After the Nth failed attempt (1-based) the
// next attempt waits base * 2^(N-1), capped. Deterministic (no jitter) so retry timing is
// unit-testable and reproducible; a production build would add jitter to avoid thundering herds.
export function nextDelayMs(attempt: number, baseMs: number, capMs: number): number {
  const raw = baseMs * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(raw, capMs);
}
