import { env } from '../config/env';
import { Embedder, EmbedderKind } from './embedder';
import { TfidfEmbedder } from './tfidfEmbedder';
import { HashingEmbedder } from './hashingEmbedder';
import { OpenAIEmbedder } from './openaiEmbedder';

// Resolve an Embedder implementation by kind (defaults to the configured EMBEDDER_KIND).
// This is the one place a real embedding backend would be wired in.
export function embedderFor(kind: EmbedderKind = env.EMBEDDER_KIND): Embedder {
  switch (kind) {
    case 'tfidf':
      return new TfidfEmbedder();
    case 'hashing':
      return new HashingEmbedder(env.EMBEDDING_DIM);
    case 'openai':
      return new OpenAIEmbedder();
    default:
      throw Object.assign(new Error(`Unsupported embedder kind: ${kind}`), {
        statusCode: 400,
      });
  }
}
