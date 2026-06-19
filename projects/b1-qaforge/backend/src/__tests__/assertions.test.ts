import { evaluateAssertion, evaluateAssertions } from '../engine/assertions';
import type { HttpResponse } from '../engine/assertions';

const makeResponse = (overrides: Partial<HttpResponse> = {}): HttpResponse => ({
  status: 200,
  headers: { 'content-type': 'application/json' },
  data: { id: 'abc', name: 'test', nested: { value: 42 } },
  ...overrides,
});

describe('evaluateAssertion — status', () => {
  it('passes when status matches', () => {
    expect(evaluateAssertion(makeResponse({ status: 200 }), { type: 'status', expected: 200 })).toEqual({ pass: true });
  });

  it('fails with reason when status mismatches', () => {
    const r = evaluateAssertion(makeResponse({ status: 404 }), { type: 'status', expected: 200 });
    expect(r.pass).toBe(false);
    expect(r.reason).toContain('404');
  });
});

describe('evaluateAssertion — jsonBody', () => {
  it('passes truthy op when field is non-empty string', () => {
    expect(
      evaluateAssertion(makeResponse(), { type: 'jsonBody', field: 'id', op: 'truthy' }),
    ).toEqual({ pass: true });
  });

  it('fails truthy op when field is falsy', () => {
    const r = evaluateAssertion(
      makeResponse({ data: { id: null } }),
      { type: 'jsonBody', field: 'id', op: 'truthy' },
    );
    expect(r.pass).toBe(false);
    expect(r.reason).toContain('falsy');
  });

  it('resolves nested dot-path', () => {
    expect(
      evaluateAssertion(makeResponse(), { type: 'jsonBody', field: 'nested.value', op: 'eq', expected: 42 }),
    ).toEqual({ pass: true });
  });

  it('fails eq op on mismatch', () => {
    const r = evaluateAssertion(makeResponse(), { type: 'jsonBody', field: 'nested.value', op: 'eq', expected: 99 });
    expect(r.pass).toBe(false);
  });
});

describe('evaluateAssertion — header', () => {
  it('passes when header contains substring', () => {
    expect(
      evaluateAssertion(makeResponse(), { type: 'header', field: 'content-type', contains: 'json' }),
    ).toEqual({ pass: true });
  });

  it('fails when header does not contain substring', () => {
    const r = evaluateAssertion(makeResponse(), { type: 'header', field: 'content-type', contains: 'xml' });
    expect(r.pass).toBe(false);
  });

  it('passes for missing header when checking empty string', () => {
    const r = evaluateAssertion(makeResponse({ headers: {} }), { type: 'header', field: 'x-missing', contains: '' });
    expect(r.pass).toBe(true);
  });
});

describe('evaluateAssertions — multiple', () => {
  it('returns pass when all assertions pass', () => {
    expect(
      evaluateAssertions(makeResponse(), [
        { type: 'status', expected: 200 },
        { type: 'jsonBody', field: 'id', op: 'truthy' },
      ]),
    ).toEqual({ pass: true });
  });

  it('stops at first failure and returns its reason', () => {
    const r = evaluateAssertions(makeResponse({ status: 500 }), [
      { type: 'status', expected: 200 },
      { type: 'jsonBody', field: 'id', op: 'truthy' },
    ]);
    expect(r.pass).toBe(false);
    expect(r.failReason).toContain('500');
  });

  it('passes for empty assertion list', () => {
    expect(evaluateAssertions(makeResponse(), [])).toEqual({ pass: true });
  });
});
