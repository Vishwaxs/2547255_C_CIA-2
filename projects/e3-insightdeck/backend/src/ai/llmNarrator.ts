import { Narrator, RawInsight } from './narrator';

// The real drop-in. Selecting NARRATOR_KIND=llm constructs fine, but narrate() throws —
// there is no API key or egress in this build. A production implementation would send the
// structured `insight.detail` to an LLM with an instruction to write a one-line headline,
// and return the text. Nothing else in the engine would change.
export class LLMNarrator implements Narrator {
  readonly kind = 'llm';

  narrate(_insight: RawInsight): string {
    throw Object.assign(
      new Error(
        'LLMNarrator needs an LLM API key and network access, neither of which exist in ' +
          'this build. Use NARRATOR_KIND=template to run offline.',
      ),
      { statusCode: 501 },
    );
  }
}
