import { SinkTransport } from '../transport/sinkTransport';

const t = new SinkTransport();
const call = (mode: string, attempt: number) => t.send({ url: 'x', mode, attempt });

describe('SinkTransport', () => {
  it('ok always succeeds', async () => {
    expect((await call('ok', 1)).ok).toBe(true);
  });
  it('fail always 500s', async () => {
    const r = await call('fail', 1);
    expect(r.ok).toBe(false);
    expect(r.statusCode).toBe(500);
  });
  it('flaky fails until the 3rd attempt', async () => {
    expect((await call('flaky', 1)).ok).toBe(false);
    expect((await call('flaky', 2)).ok).toBe(false);
    expect((await call('flaky', 3)).ok).toBe(true);
  });
  it('slow reports a timeout failure', async () => {
    const r = await call('slow', 1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timed out/);
  });
});
