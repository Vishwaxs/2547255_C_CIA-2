import { RuleBasedPlanner } from '../engine/ruleBasedPlanner';
import { LlmPlanner, buildPlannerPrompt } from '../engine/llmPlanner';
import { plannerFor } from '../engine/plannerFactory';
import { AgentStepLike, PlannerContext, ToolResult } from '../engine/types';

const planner = new RuleBasedPlanner();

const ticket = { id: 't1', customerId: 'cust-1', subject: '', body: '' };
const ctx = (subject: string, body: string, steps: AgentStepLike[] = []): PlannerContext => ({
  ticket: { ...ticket, subject, body },
  steps,
  tools: [{ name: 'search_kb', description: 'x' }],
});

const step = (action: string, observation: ToolResult, stepNumber = 1): AgentStepLike => ({
  stepNumber,
  thought: '',
  action,
  actionInput: {},
  observation,
});

// The planner is pure: it never touches a database, so every branch is driven purely by
// hand-built observation history. That is the whole benefit of keeping the world behind
// the Tool seam.
describe('RuleBasedPlanner — refund path', () => {
  it('looks up orders before doing anything else', () => {
    const d = planner.decide(ctx('Refund please', 'my keyboard broke'));
    expect(d.action).toBe('lookup_order');
    expect(d.actionInput).toEqual({ customerId: 'cust-1' });
  });

  it('escalates when the customer has no orders', () => {
    const d = planner.decide(
      ctx('Refund please', 'x', [
        step('lookup_order', { ok: false, summary: 'none', data: { orders: [] } }),
      ]),
    );
    expect(d.action).toBe('escalate');
    expect(d.actionInput.reason).toBe('no_order_found');
  });

  it('refunds the first order still in placed status', () => {
    const d = planner.decide(
      ctx('Refund please', 'x', [
        step('lookup_order', {
          ok: true,
          summary: '',
          data: {
            orders: [
              { id: 'o1', product: 'Cable', amount: 10, status: 'refunded' },
              { id: 'o2', product: 'Keyboard', amount: 90, status: 'placed' },
            ],
          },
        }),
      ]),
    );
    expect(d.action).toBe('issue_refund');
    expect(d.actionInput).toEqual({ orderId: 'o2' });
  });

  it('escalates when every order is already refunded', () => {
    const d = planner.decide(
      ctx('Refund please', 'x', [
        step('lookup_order', {
          ok: true,
          summary: '',
          data: { orders: [{ id: 'o1', product: 'Cable', amount: 10, status: 'refunded' }] },
        }),
      ]),
    );
    expect(d.action).toBe('escalate');
    expect(d.actionInput.reason).toBe('refund_failed');
  });

  it('confirms to the customer once the refund succeeds', () => {
    const d = planner.decide(
      ctx('Refund please', 'x', [
        step('lookup_order', {
          ok: true,
          summary: '',
          data: { orders: [{ id: 'o2', product: 'Keyboard', amount: 89.99, status: 'placed' }] },
        }),
        step(
          'issue_refund',
          { ok: true, summary: '', data: { orderId: 'o2', product: 'Keyboard', amount: 89.99 } },
          2,
        ),
      ]),
    );
    expect(d.action).toBe('respond');
    expect(d.actionInput.outcome).toBe('refund_issued');
    expect(d.actionInput.message).toContain('89.99');
  });

  it('escalates rather than retrying when the refund tool refuses', () => {
    const d = planner.decide(
      ctx('Refund please', 'x', [
        step('lookup_order', {
          ok: true,
          summary: '',
          data: { orders: [{ id: 'o2', product: 'K', amount: 9, status: 'placed' }] },
        }),
        step('issue_refund', { ok: false, summary: 'already refunded', data: {} }, 2),
      ]),
    );
    expect(d.action).toBe('escalate');
    expect(d.actionInput.reason).toBe('refund_failed');
  });
});

describe('RuleBasedPlanner — question path', () => {
  it('searches the knowledge base first', () => {
    const d = planner.decide(ctx('Forgot password', 'help'));
    expect(d.action).toBe('search_kb');
    expect(String(d.actionInput.query)).toContain('Forgot password');
  });

  it('answers from the top confident article', () => {
    const d = planner.decide(
      ctx('Forgot password', 'help', [
        step('search_kb', {
          ok: true,
          summary: '',
          data: {
            results: [
              { id: 'a1', title: 'Resetting your password', score: 9, snippet: 'Open Settings.', matchedTerms: ['reset', 'password'] },
            ],
          },
        }),
      ]),
    );
    expect(d.action).toBe('respond');
    expect(d.actionInput.outcome).toBe('answered_from_kb');
    expect(d.actionInput.articleId).toBe('a1');
  });

  it('escalates when nothing matched at all', () => {
    const d = planner.decide(
      ctx('Internships?', 'x', [
        step('search_kb', { ok: false, summary: '', data: { results: [], rejected: [] } }),
      ]),
    );
    expect(d.action).toBe('escalate');
    expect(d.actionInput.reason).toBe('no_kb_coverage');
  });

  it('names the rejected near-miss in its reasoning instead of quoting it', () => {
    const d = planner.decide(
      ctx('Internships?', 'x', [
        step('search_kb', {
          ok: false,
          summary: '',
          data: {
            results: [],
            rejected: [
              { id: 'a5', title: 'Updating your email', score: 1, snippet: '', matchedTerms: ['takes'] },
            ],
          },
        }),
      ]),
    );
    expect(d.action).toBe('escalate');
    expect(d.actionInput.reason).toBe('no_kb_coverage');
    expect(d.thought).toContain('Updating your email');
    expect(d.thought).toContain('takes');
  });
});

describe('LlmPlanner — the seam', () => {
  it('fails loudly with 501 rather than pretending to be a model', () => {
    expect(() => new LlmPlanner().decide(ctx('x', 'y'))).toThrow(/ANTHROPIC_API_KEY/);
    try {
      new LlmPlanner().decide(ctx('x', 'y'));
    } catch (e) {
      expect((e as { statusCode?: number }).statusCode).toBe(501);
    }
  });

  it('renders a prompt containing the tools, the ticket and the prior steps', () => {
    const prompt = buildPlannerPrompt(
      ctx('Refund', 'broken', [step('lookup_order', { ok: true, summary: 'found 1', data: {} })]),
    );
    expect(prompt).toContain('search_kb');
    expect(prompt).toContain('Refund');
    expect(prompt).toContain('lookup_order');
    expect(prompt).toContain('found 1');
    expect(prompt).toContain('"thought"');
  });
});

describe('plannerFor', () => {
  it('returns the deterministic planner by default', () => {
    expect(plannerFor('rule_based').kind).toBe('rule_based');
  });
  it('returns the llm planner when asked', () => {
    expect(plannerFor('llm').kind).toBe('llm');
  });
});
