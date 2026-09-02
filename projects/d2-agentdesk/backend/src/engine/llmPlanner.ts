import { Planner, PlannerContext, PlannerDecision } from './types';

/** Renders the exact prompt an LLM planner would be given. It is a real function rather
 *  than a comment so the seam is inspectable and testable: you can read precisely what the
 *  model would see, and the shape it is required to return, without an API key. */
export function buildPlannerPrompt(ctx: PlannerContext): string {
  const tools = ctx.tools.map((t) => `  - ${t.name}: ${t.description}`).join('\n');
  const history = ctx.steps.length
    ? ctx.steps
        .map(
          (s) =>
            `Step ${s.stepNumber}\n  Thought: ${s.thought}\n  Action: ${s.action}\n  Action Input: ${JSON.stringify(s.actionInput)}\n  Observation: ${JSON.stringify(s.observation)}`,
        )
        .join('\n\n')
    : '  (none yet — this is the first step)';

  return [
    'You are a support agent working one ticket. Reason one step at a time.',
    '',
    'Available tools:',
    tools,
    '  - respond: finish by answering the customer. Input: { message, outcome }',
    '  - escalate: hand off to a human. Input: { reason, detail }',
    '',
    `Ticket ${ctx.ticket.id} from ${ctx.ticket.customerId}`,
    `Subject: ${ctx.ticket.subject}`,
    `Body: ${ctx.ticket.body}`,
    '',
    'History so far:',
    history,
    '',
    'Reply with exactly one JSON object and nothing else:',
    '{ "thought": string, "action": string, "actionInput": object }',
    'Never answer from memory — only from what a tool actually returned. If the tools',
    'cannot establish the facts you need, escalate.',
  ].join('\n');
}

/**
 * The drop-in seam, kept honest.
 *
 * Selecting PLANNER_KIND=llm constructs fine and buildPlannerPrompt above is fully
 * implemented — what is missing is a key and egress, neither of which exists in this
 * build. Rather than ship a mock that pretends to be a model, decide() fails loudly with
 * a 501 so the limitation is impossible to mistake for working behaviour.
 *
 * Making this real is one function body: POST the prompt to the Messages API, JSON.parse
 * the reply into a PlannerDecision, and validate `action` against ctx.tools. Nothing in
 * loop.ts, the tool registry, the persistence layer, or the API would change.
 */
export class LlmPlanner implements Planner {
  readonly kind = 'llm';

  decide(_ctx: PlannerContext): PlannerDecision {
    throw Object.assign(
      new Error(
        'LlmPlanner requires ANTHROPIC_API_KEY and outbound network access, neither of ' +
          'which is available in this build. Set PLANNER_KIND=rule_based to run the ' +
          'deterministic planner offline.',
      ),
      { statusCode: 501 },
    );
  }
}
