import { tokenize } from '../engine/chunk';
import { Generator, GeneratorContext, GeneratorResult, NOT_FOUND_ANSWER } from './generator';

// Split a chunk into sentences. Keeps it simple and deterministic: break after
// ., !, ? followed by whitespace. Good enough for extractive selection.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const MAX_SENTENCES = 3;

// Offline generator: pure extractive QA. It scores each sentence in the retrieved
// chunks by how many question terms it contains, takes the best few, and stitches
// them back together in reading order with inline [n] citations (n = 1-based index
// into the retrieved contexts). It can ONLY emit text drawn from the source chunks,
// so it cannot hallucinate. If no sentence shares a term with the question it refuses
// — the groundedness guarantee, enforced at the generation layer as well as retrieval.
export class ExtractiveGenerator implements Generator {
  readonly kind = 'extractive';

  generate(question: string, contexts: GeneratorContext[]): GeneratorResult {
    if (contexts.length === 0) {
      return { answer: NOT_FOUND_ANSWER, citedIndices: [], refused: true };
    }
    const qTokens = new Set(tokenize(question));
    if (qTokens.size === 0) {
      return { answer: NOT_FOUND_ANSWER, citedIndices: [], refused: true };
    }

    interface Candidate {
      ctxIndex: number;
      sentence: string;
      score: number;
      order: number;
    }
    const candidates: Candidate[] = [];
    let order = 0;
    contexts.forEach((ctx, ctxIndex) => {
      for (const sentence of splitSentences(ctx.text)) {
        const sentenceTokens = new Set(tokenize(sentence));
        let overlap = 0;
        for (const qt of qTokens) if (sentenceTokens.has(qt)) overlap++;
        // Tie-break toward sentences from higher-scoring chunks.
        const score = overlap + ctx.score * 0.001;
        candidates.push({ ctxIndex, sentence, score, order: order++ });
      }
    });

    // Keep only sentences that actually share a term with the question.
    const relevant = candidates
      .filter((c) => c.score >= 1)
      .sort((a, b) => b.score - a.score || a.order - b.order);

    if (relevant.length === 0) {
      return { answer: NOT_FOUND_ANSWER, citedIndices: [], refused: true };
    }

    // Take the best few, then restore reading order so the answer flows naturally.
    const chosen = relevant.slice(0, MAX_SENTENCES).sort((a, b) => a.order - b.order);
    const cited = new Set<number>();
    const answer = chosen
      .map((c) => {
        cited.add(c.ctxIndex);
        return `${c.sentence} [${c.ctxIndex + 1}]`;
      })
      .join(' ');

    return {
      answer,
      citedIndices: [...cited].sort((a, b) => a - b),
      refused: false,
    };
  }
}
