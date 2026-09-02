import { Prisma, Document } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { chunkText, tokenCount } from '../engine/chunk';
import { embedderFor } from '../ai/embedderFactory';
import { sha256 } from './corpus.service';

export interface IngestResult {
  document: Document;
  created: boolean;
}

// Ingest a document: dedupe by content hash, chunk it, persist the chunks, then
// re-index the whole corpus so the embedder's corpus-global statistics stay consistent.
export async function ingestDocument(input: {
  title: string;
  text: string;
  source: string;
}): Promise<IngestResult> {
  const contentHash = sha256(input.text);

  // Idempotent: re-uploading identical text is a no-op that returns the existing doc.
  const existing = await prisma.document.findFirst({ where: { contentHash } });
  if (existing) return { document: existing, created: false };

  const chunks = chunkText(input.text);
  const doc = await prisma.document.create({
    data: {
      title: input.title,
      source: input.source,
      contentHash,
      charCount: input.text.length,
      chunkCount: chunks.length,
    },
  });
  // Chunks are stored without vectors first; reindexCorpus fills every vector so the
  // new document and all existing ones share one consistent embedding space.
  await prisma.chunk.createMany({
    data: chunks.map((c) => ({
      documentId: doc.id,
      index: c.index,
      text: c.text,
      charStart: c.charStart,
      charEnd: c.charEnd,
      embedding: [] as Prisma.InputJsonValue,
      embedderKind: env.EMBEDDER_KIND,
      dimension: 0,
      tokenCount: tokenCount(c.text),
    })),
  });

  await reindexCorpus();
  const refreshed = await prisma.document.findUnique({ where: { id: doc.id } });
  return { document: refreshed ?? doc, created: true };
}

export async function deleteDocument(id: string): Promise<boolean> {
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.document.delete({ where: { id } }); // cascades to chunks + retrievals
  await reindexCorpus();
  return true;
}

// Re-fit the configured embedder over ALL chunk texts and rewrite every chunk vector.
// For TF-IDF this keeps the corpus-global IDF consistent after any add/delete; for
// hashing/OpenAI (no corpus statistics) it is simply a straight re-embed. The cost is
// O(corpus) per change — fine at portfolio scale; pushing kNN into pgvector is the
// documented scale path (see DECISIONS.md).
export async function reindexCorpus(): Promise<void> {
  const chunks = await prisma.chunk.findMany({ orderBy: { id: 'asc' } });
  if (chunks.length === 0) return;

  const embedder = embedderFor();
  const texts = chunks.map((c) => c.text);
  embedder.fit(texts);
  const vectors = embedder.embed(texts);

  await prisma.$transaction(
    chunks.map((c, i) =>
      prisma.chunk.update({
        where: { id: c.id },
        data: {
          embedding: vectors[i] as Prisma.InputJsonValue,
          embedderKind: embedder.kind,
          dimension: embedder.dimension,
        },
      }),
    ),
  );
}
