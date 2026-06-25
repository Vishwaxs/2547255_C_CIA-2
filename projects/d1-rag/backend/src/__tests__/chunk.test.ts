import { chunkText, tokenize, tokenCount } from '../engine/chunk';

describe('chunkText', () => {
  const text = 'A'.repeat(50) + 'B'.repeat(50) + 'C'.repeat(50); // 150 chars

  it('every chunk text matches its offsets', () => {
    const chunks = chunkText(text, { size: 60, overlap: 20 });
    for (const c of chunks) {
      expect(c.text).toBe(text.slice(c.charStart, c.charEnd));
    }
  });

  it('consecutive chunks step by size - overlap', () => {
    const chunks = chunkText(text, { size: 60, overlap: 20 });
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].charStart - chunks[i - 1].charStart).toBe(40);
    }
  });

  it('the final chunk ends exactly at the text length (full coverage)', () => {
    const chunks = chunkText(text, { size: 60, overlap: 20 });
    expect(chunks[chunks.length - 1].charEnd).toBe(text.length);
  });

  it('text shorter than the window yields one chunk spanning the whole text', () => {
    const chunks = chunkText('hello world', { size: 60, overlap: 20 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ index: 0, charStart: 0, charEnd: 11 });
  });

  it('empty or whitespace-only text yields zero chunks', () => {
    expect(chunkText('', { size: 60, overlap: 20 })).toHaveLength(0);
    expect(chunkText('   \n\t ', { size: 60, overlap: 20 })).toHaveLength(0);
  });

  it('rejects invalid options', () => {
    expect(() => chunkText(text, { size: 0, overlap: 0 })).toThrow();
    expect(() => chunkText(text, { size: 10, overlap: 10 })).toThrow();
  });
});

describe('tokenize', () => {
  it('lowercases and splits on non-alphanumerics', () => {
    expect(tokenize('Hello, World! 42_x')).toEqual(['hello', 'world', '42', 'x']);
  });

  it('drops stopwords', () => {
    expect(tokenize('How do I index a database')).toEqual(['index', 'database']);
  });

  it('counts content tokens', () => {
    expect(tokenCount('the cat and the dog')).toBe(2); // cat, dog (stopwords dropped)
  });
});
