import { ExtractiveGenerator } from '../ai/extractiveGenerator';
import { ClaudeGenerator } from '../ai/claudeGenerator';
import { tokenize } from '../engine/chunk';
import { NOT_FOUND_ANSWER } from '../ai/generator';

const gen = new ExtractiveGenerator();

const httpContext = {
  chunkId: 'c1',
  score: 0.4,
  text:
    'HTTP status codes tell the client how a request was handled. A 404 means the requested ' +
    'resource was not found. A 500 means the server failed.',
};

describe('ExtractiveGenerator', () => {
  it('refuses when there are no contexts', () => {
    const r = gen.generate('what is a 404?', []);
    expect(r.refused).toBe(true);
    expect(r.answer).toBe(NOT_FOUND_ANSWER);
    expect(r.citedIndices).toEqual([]);
  });

  it('refuses when the question is all stopwords (no content tokens)', () => {
    const r = gen.generate('what is the', [httpContext]);
    expect(r.refused).toBe(true);
  });

  it('answers from context, cites a valid index, and never invents tokens', () => {
    const r = gen.generate('What does a 404 status code mean?', [httpContext]);
    expect(r.refused).toBe(false);
    expect(r.answer).toMatch(/\[1\]/);
    expect(r.citedIndices).toEqual([0]);

    // No hallucination: every word in the answer (minus [n] markers) comes from the source.
    const sourceTokens = new Set(tokenize(httpContext.text));
    const answerTokens = tokenize(r.answer.replace(/\[\d+\]/g, ''));
    for (const t of answerTokens) expect(sourceTokens.has(t)).toBe(true);
  });

  it('refuses when the context shares no terms with the question', () => {
    const r = gen.generate('How do I bake sourdough bread?', [httpContext]);
    expect(r.refused).toBe(true);
  });
});

describe('ClaudeGenerator (stub)', () => {
  it('throws synchronously instead of attempting a network call', () => {
    const c = new ClaudeGenerator();
    expect(() => c.generate('q', [httpContext])).toThrow(/ANTHROPIC_API_KEY|offline/i);
  });
});
