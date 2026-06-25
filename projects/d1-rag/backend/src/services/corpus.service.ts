import crypto from 'crypto';
import { prisma } from '../lib/prisma';

export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// corpusVersion is a content hash of the whole corpus: sha256 over every document's
// contentHash, sorted. It changes exactly when a document is added or removed (not
// when a timestamp moves), which is the correct trigger for invalidating the answer
// cache — with TF-IDF the IDF, and therefore every chunk vector, is a function of the
// entire corpus. An empty corpus is the sentinel "empty".
export async function computeCorpusVersion(): Promise<string> {
  const docs = await prisma.document.findMany({
    select: { contentHash: true },
    orderBy: { contentHash: 'asc' },
  });
  if (docs.length === 0) return 'empty';
  return sha256(docs.map((d) => d.contentHash).join('|')).slice(0, 16);
}
