import { Generator, GeneratorContext, GeneratorResult } from './generator';

// The real drop-in. Selecting GENERATOR_KIND=claude constructs fine, but generate()
// throws — there is no API key or egress in this build. A production implementation
// would send the question + retrieved contexts to the Claude Messages API with an
// instruction to answer only from the provided context and cite [n], then parse the
// reply into this same GeneratorResult. Nothing else in the engine would change.
export class ClaudeGenerator implements Generator {
  readonly kind = 'claude';

  generate(_question: string, _contexts: GeneratorContext[]): GeneratorResult {
    throw Object.assign(
      new Error(
        'ClaudeGenerator needs ANTHROPIC_API_KEY and network access, neither of which ' +
          'exist in this build. Use GENERATOR_KIND=extractive to run offline.',
      ),
      { statusCode: 501 },
    );
  }
}
