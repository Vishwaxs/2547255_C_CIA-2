// Declarative assertion evaluator for QAForge test cases.
// Each assertion is a plain JSON object stored on TestCase.assertions.

export type Assertion =
  | { type: 'status'; expected: number }
  | { type: 'jsonBody'; field: string; op: 'truthy' | 'eq'; expected?: unknown }
  | { type: 'header'; field: string; contains: string };

export interface AssertionResult {
  pass: boolean;
  reason?: string;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  data: unknown;
}

function getNestedField(obj: unknown, dotPath: string): unknown {
  return dotPath.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function evaluateAssertion(
  response: HttpResponse,
  assertion: Assertion,
): AssertionResult {
  switch (assertion.type) {
    case 'status': {
      const pass = response.status === assertion.expected;
      return pass
        ? { pass: true }
        : { pass: false, reason: `expected status ${assertion.expected}, got ${response.status}` };
    }
    case 'jsonBody': {
      const value = getNestedField(response.data, assertion.field);
      if (assertion.op === 'truthy') {
        const pass = Boolean(value);
        return pass
          ? { pass: true }
          : { pass: false, reason: `field "${assertion.field}" is falsy (got ${JSON.stringify(value)})` };
      }
      // op === 'eq'
      const pass = JSON.stringify(value) === JSON.stringify(assertion.expected);
      return pass
        ? { pass: true }
        : {
            pass: false,
            reason: `field "${assertion.field}": expected ${JSON.stringify(assertion.expected)}, got ${JSON.stringify(value)}`,
          };
    }
    case 'header': {
      const headerValue = response.headers[assertion.field.toLowerCase()];
      const str = Array.isArray(headerValue) ? headerValue.join(', ') : (headerValue ?? '');
      const pass = str.includes(assertion.contains);
      return pass
        ? { pass: true }
        : { pass: false, reason: `header "${assertion.field}" ("${str}") does not contain "${assertion.contains}"` };
    }
  }
}

export function evaluateAssertions(
  response: HttpResponse,
  assertions: Assertion[],
): { pass: boolean; failReason?: string } {
  for (const a of assertions) {
    const result = evaluateAssertion(response, a);
    if (!result.pass) return { pass: false, failReason: result.reason };
  }
  return { pass: true };
}
