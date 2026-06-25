import { tokenize } from '../engine/chunk';
import { l2normalize } from '../engine/vector';
import { Embedder } from './embedder';

// Default offline embedder: classic TF-IDF with cosine similarity — the textbook
// pre-neural retrieval baseline. Deterministic, dependency-free, and interpretable
// (every dimension is a real vocabulary term, no hash collisions).
//
// Honest limitation (see DECISIONS.md): this matches on lexical overlap only — it has
// no semantic understanding, so "car" and "automobile" are orthogonal. Closing that
// gap is exactly what a real embedding model does behind this same interface.
export class TfidfEmbedder implements Embedder {
  readonly kind = 'tfidf';
  private vocab: string[] = [];
  private vocabIndex = new Map<string, number>();
  private idf: number[] = [];

  get dimension(): number {
    return this.vocab.length;
  }

  // Build the vocabulary and inverse-document-frequency weights from the corpus.
  // Each chunk is one "document". IDF uses sklearn's smoothed form
  // ln((1+N)/(1+df)) + 1, which is always >= 1 (never zeroing a vector outright)
  // while still down-weighting ubiquitous terms relative to rare, discriminative ones.
  fit(corpus: string[]): void {
    const df = new Map<string, number>();
    const n = corpus.length;
    for (const doc of corpus) {
      for (const term of new Set(tokenize(doc))) {
        df.set(term, (df.get(term) ?? 0) + 1);
      }
    }
    this.vocab = [...df.keys()].sort();
    this.vocabIndex = new Map(this.vocab.map((t, i) => [t, i]));
    this.idf = this.vocab.map((t) => Math.log((1 + n) / (1 + (df.get(t) ?? 0))) + 1);
  }

  embed(texts: string[]): number[][] {
    return texts.map((text) => {
      const vec = new Array<number>(this.vocab.length).fill(0);
      const tokens = tokenize(text);
      if (tokens.length === 0 || this.vocab.length === 0) return vec;

      const tf = new Map<number, number>();
      for (const tok of tokens) {
        const idx = this.vocabIndex.get(tok);
        if (idx !== undefined) tf.set(idx, (tf.get(idx) ?? 0) + 1);
      }
      for (const [idx, count] of tf) {
        vec[idx] = (count / tokens.length) * this.idf[idx];
      }
      return l2normalize(vec);
    });
  }
}
