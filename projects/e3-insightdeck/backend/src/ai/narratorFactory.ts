import { env } from '../config/env';
import { Narrator, NarratorKind } from './narrator';
import { TemplateNarrator } from './templateNarrator';
import { LLMNarrator } from './llmNarrator';

export function narratorFor(kind: NarratorKind = env.NARRATOR_KIND): Narrator {
  switch (kind) {
    case 'template':
      return new TemplateNarrator();
    case 'llm':
      return new LLMNarrator();
    default:
      throw Object.assign(new Error(`Unsupported narrator kind: ${kind}`), { statusCode: 400 });
  }
}
