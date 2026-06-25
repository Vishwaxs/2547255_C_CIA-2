import { Embedder } from './embedder';

// The real drop-in. It proves the seam without needing the network: selecting
// EMBEDDER_KIND=openai constructs fine, but embed() throws synchronously — there is
// no API key or egress in this build, and the air-gap is enforced by code, not luck.
// A production implementation would POST to /v1/embeddings here and return the vectors;
// nothing else in the engine would change.
export class OpenAIEmbedder implements Embedder {
  readonly kind = 'openai';
  readonly dimension = 1536; // text-embedding-3-small

  fit(_corpus: string[]): void {
    // no-op: a hosted model carries its own learned parameters
  }

  embed(_texts: string[]): number[][] {
    throw Object.assign(
      new Error(
        'OpenAIEmbedder needs OPENAI_API_KEY and network access, neither of which ' +
          'exist in this build. Use EMBEDDER_KIND=tfidf (or hashing) to run offline.',
      ),
      { statusCode: 501 },
    );
  }
}
