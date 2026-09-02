// The Generator is the second swap point: it turns a question + retrieved chunks into
// an answer with citations. The offline ExtractiveGenerator backs it here; a real
// ClaudeGenerator would implement the same single method over an LLM API with no other
// engine change.

export interface GeneratorContext {
  chunkId: string;
  text: string;
  score: number; // retrieval score, available to the generator for ranking
}

export interface GeneratorResult {
  answer: string;
  // 0-based indices into the contexts array that actually contributed to the answer.
  citedIndices: number[];
  // true when the generator could not ground an answer in the supplied contexts.
  refused: boolean;
}

export interface Generator {
  readonly kind: string;
  generate(question: string, contexts: GeneratorContext[]): GeneratorResult;
}

export const GENERATOR_KINDS = ['extractive', 'claude'] as const;
export type GeneratorKind = (typeof GENERATOR_KINDS)[number];

// The canned response when nothing in the corpus answers the question. Refusing
// rather than inventing an answer is the faithfulness guarantee of the system.
export const NOT_FOUND_ANSWER = "I couldn't find this in the provided documents.";
