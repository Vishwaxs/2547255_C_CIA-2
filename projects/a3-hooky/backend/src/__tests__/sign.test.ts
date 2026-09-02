import { sign, verify, signedHeaders, generateSecret } from '../engine/sign';

describe('sign / verify', () => {
  it('is deterministic for the same inputs', () => {
    expect(sign('secret', '{"a":1}', 1000)).toBe(sign('secret', '{"a":1}', 1000));
  });
  it('produces a sha256= prefixed hex digest', () => {
    expect(sign('s', 'p', 1)).toMatch(/^sha256=[0-9a-f]{64}$/);
  });
  it('verifies a valid signature and rejects tampering', () => {
    const s = sign('secret', 'payload', 1234);
    expect(verify('secret', 'payload', 1234, s)).toBe(true);
    expect(verify('secret', 'payload-x', 1234, s)).toBe(false); // body changed
    expect(verify('secret', 'payload', 9999, s)).toBe(false); // timestamp changed
    expect(verify('other', 'payload', 1234, s)).toBe(false); // secret changed
  });
  it('signedHeaders carries id/event/timestamp/signature', () => {
    const h = signedHeaders({ deliveryId: 'd1', eventType: 'order.created', secret: 's', payload: '{}', timestamp: 5 });
    expect(h['X-Hooky-Id']).toBe('d1');
    expect(h['X-Hooky-Event']).toBe('order.created');
    expect(h['X-Hooky-Timestamp']).toBe('5');
    expect(verify('s', '{}', 5, h['X-Hooky-Signature'])).toBe(true);
  });
  it('generates unique secrets', () => {
    expect(generateSecret()).not.toBe(generateSecret());
    expect(generateSecret()).toMatch(/^whsec_/);
  });
});
