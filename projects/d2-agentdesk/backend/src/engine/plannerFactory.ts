import { env } from '../config/env';
import { Planner, PlannerKind } from './types';
import { RuleBasedPlanner } from './ruleBasedPlanner';
import { LlmPlanner } from './llmPlanner';

/** The single place the planner implementation is chosen. Everything downstream depends on
 *  the Planner interface only, so this switch is the entire cost of swapping brains. */
export function plannerFor(kind: PlannerKind = env.PLANNER_KIND): Planner {
  switch (kind) {
    case 'rule_based':
      return new RuleBasedPlanner();
    case 'llm':
      return new LlmPlanner();
    default:
      throw Object.assign(new Error(`Unsupported planner kind: ${kind}`), { statusCode: 400 });
  }
}
