// The Embedder interface is one of the two swap points of the whole RAG engine.
// Offline, deterministic implementations (TF-IDF, feature-hashing) back it here; a
// real OpenAIEmbedder would implement the same three members over HTTP without any
// change to chunking, retrieval, generation, or the routes. The engine depends only
// on this interface — that is the entire point of the air-gapped mock strategy.

export interface Embedder {
  readonly kind: string;

  /** Current vector length. For TF-IDF this is the vocabulary size (known after fit). */
  readonly dimension: number;

  /**
   * Learn any corpus-global statistics needed before embedding. TF-IDF builds its
   * vocabulary + IDF here; hashing/OpenAI are no-ops. The engine always calls
   * fit(corpus) before embedding so every implementation is treated identically.
   */
  fit(corpus: string[]): void;

  /** Map each input text to a (typically L2-normalized) vector. */
  embed(texts: string[]): number[][];
}

export const EMBEDDER_KINDS = ['tfidf', 'hashing', 'openai'] as const;
export type EmbedderKind = (typeof EMBEDDER_KINDS)[number];
