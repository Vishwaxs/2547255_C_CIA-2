import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { env } from '../config/env';
import { embedderFor } from '../ai/embedderFactory';
import { generatorFor } from '../ai/generatorFactory';
import { topKByCosine } from '../engine/vector';
import { GeneratorContext } from '../ai/generator';
import { HttpError } from '../middleware/errorHandler';
import { computeCorpusVersion, sha256 } from './corpus.service';

export interface Citation {
  marker: number; // 1-based [n] used in the answer text
  chunkId: string;
  documentId: string;
  documentTitle: string;
  text: string;
  charStart: number;
  charEnd: number;
  score: number;
}

export interface RetrievedItem {
  rank: number; // 1-based
  chunkId: string;
  documentId: string;
  documentTitle: string;
  score: number;
  cited: boolean;
  text: string;
}

export interface QueryResult {
  id: string;
  question: string;
  answer: string;
  refused: boolean;
  cacheHit: boolean;
  topScore: number | null;
  topK: number;
  threshold: number;
  latencyMs: number;
  embedderKind: string;
  generatorKind: string;
  citations: Citation[];
  retrieved: RetrievedItem[];
}

// The cached payload is everything except the per-request fields (id/cacheHit/latency),
// which are stamped fresh on every call so each query is still recorded individually.
type CachedAnswer = Omit<QueryResult, 'id' | 'cacheHit' | 'latencyMs'>;

export async function answerQuestion(input: {
  question: string;
  topK?: number;
  threshold?: number;
}): Promise<QueryResult> {
  const started = Date.now();
  const topK = input.topK ?? env.RETRIEVAL_TOP_K;
  const threshold = input.threshold ?? env.RETRIEVAL_THRESHOLD;

  const corpusVersion = await computeCorpusVersion();
  const cacheKey = `rag:ans:${corpusVersion}:${sha256(`${input.question}|${topK}|${threshold}`)}`;

  // Cache-aside, fail-open: a Redis outage degrades to a normal (uncached) query.
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) {
    try {
      const payload = JSON.parse(cached) as CachedAnswer;
      return await persistAndReturn(payload, true, started);
    } catch {
      // Corrupt cache entry — fall through and recompute.
    }
  }

  const payload = await computeAnswer(input.question, topK, threshold);

  // Populate the cache (fail-open). Empty-corpus results are cached under the "empty"
  // version and naturally invalidate as soon as the first document is ingested.
  if (env.ANSWER_CACHE_TTL_SECONDS > 0) {
    await redis
      .set(cacheKey, JSON.stringify(payload), 'EX', env.ANSWER_CACHE_TTL_SECONDS)
      .catch(() => undefined);
  }

  return await persistAndReturn(payload, false, started);
}

async function computeAnswer(
  question: string,
  topK: number,
  threshold: number,
): Promise<CachedAnswer> {
  const chunks = await prisma.chunk.findMany({
    include: { document: { select: { title: true } } },
    orderBy: { id: 'asc' },
  });

  const base = {
    question,
    topK,
    threshold,
    embedderKind: env.EMBEDDER_KIND,
    generatorKind: env.GENERATOR_KIND,
  };

  if (chunks.length === 0) {
    return {
      ...base,
      answer: 'No documents have been added yet. Add or seed a document, then ask again.',
      refused: true,
      topScore: null,
      citations: [],
      retrieved: [],
    };
  }

  // Dimension/embedder guard: stored vectors must come from the embedder we're about to
  // query with, or cosine would compare incompatible spaces and silently rank garbage.
  const mismatched = chunks.find((c) => c.embedderKind !== env.EMBEDDER_KIND);
  if (mismatched) {
    throw new HttpError(
      409,
      `Corpus was indexed with embedder "${mismatched.embedderKind}" but EMBEDDER_KIND is ` +
        `"${env.EMBEDDER_KIND}". Re-index the corpus (re-add documents) or restore the embedder.`,
    );
  }

  const embedder = embedderFor();
  embedder.fit(chunks.map((c) => c.text));
  const queryVec = embedder.embed([question])[0];

  const ranked = topKByCosine(
    queryVec,
    chunks.map((c) => ({ id: c.id, vector: c.embedding as number[] })),
    topK,
  );
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const topScore = ranked.length > 0 ? ranked[0].score : null;

  // Threshold gate: only chunks clearing the bar become generation context. The rest
  // are still recorded (the "considered and rejected" audit).
  const gated = ranked.filter((r) => r.score >= threshold);
  const contexts: GeneratorContext[] = gated.map((r) => {
    const chunk = byId.get(r.id)!;
    return { chunkId: r.id, text: chunk.text, score: r.score };
  });

  const gen = generatorFor();
  const result = gen.generate(question, contexts);

  const citedChunkIds = new Set(result.citedIndices.map((i) => contexts[i].chunkId));
  const citations: Citation[] = result.citedIndices.map((i) => {
    const ctx = contexts[i];
    const chunk = byId.get(ctx.chunkId)!;
    return {
      marker: i + 1,
      chunkId: ctx.chunkId,
      documentId: chunk.documentId,
      documentTitle: chunk.document.title,
      text: chunk.text,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
      score: ctx.score,
    };
  });

  const retrieved: RetrievedItem[] = ranked.map((r, idx) => {
    const chunk = byId.get(r.id)!;
    return {
      rank: idx + 1,
      chunkId: r.id,
      documentId: chunk.documentId,
      documentTitle: chunk.document.title,
      score: r.score,
      cited: citedChunkIds.has(r.id),
      text: chunk.text,
    };
  });

  return {
    ...base,
    answer: result.answer,
    refused: result.refused,
    topScore,
    citations,
    retrieved,
  };
}

// Persist one Query row plus its Retrieval audit rows, then return the full result.
// Runs for cached and uncached answers alike, so every question is counted in analytics.
async function persistAndReturn(
  payload: CachedAnswer,
  cacheHit: boolean,
  started: number,
): Promise<QueryResult> {
  const latencyMs = Date.now() - started;
  const row = await prisma.query.create({
    data: {
      question: payload.question,
      answer: payload.answer,
      refused: payload.refused,
      cacheHit,
      topScore: payload.topScore,
      topK: payload.topK,
      threshold: payload.threshold,
      latencyMs,
      embedderKind: payload.embedderKind,
      generatorKind: payload.generatorKind,
      retrievals: {
        create: payload.retrieved.map((r) => ({
          chunkId: r.chunkId,
          score: r.score,
          rank: r.rank,
          cited: r.cited,
        })),
      },
    },
  });

  return { ...payload, id: row.id, cacheHit, latencyMs };
}
