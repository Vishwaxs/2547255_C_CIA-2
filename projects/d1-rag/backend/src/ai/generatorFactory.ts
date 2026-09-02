import { env } from '../config/env';
import { Generator, GeneratorKind } from './generator';
import { ExtractiveGenerator } from './extractiveGenerator';
import { ClaudeGenerator } from './claudeGenerator';

// Resolve a Generator implementation by kind (defaults to the configured GENERATOR_KIND).
export function generatorFor(kind: GeneratorKind = env.GENERATOR_KIND): Generator {
  switch (kind) {
    case 'extractive':
      return new ExtractiveGenerator();
    case 'claude':
      return new ClaudeGenerator();
    default:
      throw Object.assign(new Error(`Unsupported generator kind: ${kind}`), {
        statusCode: 400,
      });
  }
}
