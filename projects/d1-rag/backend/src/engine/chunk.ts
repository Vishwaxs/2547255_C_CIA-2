// Pure document chunking: split text into overlapping character windows, preserving
// the exact [charStart, charEnd) offsets so an answer can cite back into the source.
// No dependencies, no I/O — fully unit-testable.

export interface TextChunk {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
}

export interface ChunkOptions {
  size: number; // target window size in characters
  overlap: number; // characters shared between consecutive windows
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { size: 800, overlap: 120 };

// Slide a window of `size` across the text, stepping by `size - overlap`. Guarantees:
//   - chunk.text === text.slice(chunk.charStart, chunk.charEnd) for every chunk
//   - consecutive chunks start exactly `size - overlap` apart (so they overlap by `overlap`)
//   - the final chunk always ends at text.length (full coverage, no trailing gap)
//   - text shorter than `size` yields one chunk spanning [0, length]
//   - empty / whitespace-only text yields zero chunks
export function chunkText(text: string, opts: ChunkOptions = DEFAULT_CHUNK_OPTIONS): TextChunk[] {
  const { size, overlap } = opts;
  if (size <= 0) throw new Error('chunk size must be positive');
  if (overlap < 0 || overlap >= size) {
    throw new Error('chunk overlap must be >= 0 and < size');
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  const chunks: TextChunk[] = [];
  const stride = size - overlap;
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push({ index, text: text.slice(start, end), charStart: start, charEnd: end });
    index++;
    if (end === text.length) break;
    start += stride;
  }

  return chunks;
}

// Cheap whitespace tokenizer, shared by the chunker (token counts) and the embedders.
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

export function tokenCount(text: string): number {
  return tokenize(text).length;
}
