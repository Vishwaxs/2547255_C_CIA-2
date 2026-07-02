import { nextDelayMs } from '../engine/backoff';

describe('nextDelayMs', () => {
  it('doubles each attempt from the base', () => {
    expect([1, 2, 3, 4, 5].map((a) => nextDelayMs(a, 2000, 300000))).toEqual([2000, 4000, 8000, 16000, 32000]);
  });
  it('caps the delay', () => {
    expect(nextDelayMs(20, 2000, 30000)).toBe(30000);
  });
});
