import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { env } from '../config/env';
import { buildFrame } from '../engine/frame';
import { runDetectors, DetectorConfig } from '../engine/detectors';
import { narratorFor } from '../ai/narratorFactory';
import { HttpError } from '../middleware/errorHandler';

function detectorConfig(): DetectorConfig {
  return {
    correlationThreshold: env.CORRELATION_THRESHOLD,
    outlierIqrFactor: env.OUTLIER_IQR_FACTOR,
    dominantThreshold: env.DOMINANT_CATEGORY_THRESHOLD,
    missingnessThreshold: env.MISSINGNESS_THRESHOLD,
  };
}

interface InsightRow {
  type: string;
  title: string;
  score: number;
  chartType: string;
  chartSpec: unknown;
  detail: unknown;
  columns: unknown;
  rank: number;
}

// What we cache: the narrated, ranked insights (keyed by dataset content + narrator).
interface DeckPayload {
  narratorKind: string;
  insights: InsightRow[];
}

export interface DeckResult {
  id: string;
  datasetId: string;
  generatedAt: Date;
  narratorKind: string;
  insightCount: number;
  cacheHit: boolean;
  insights: InsightRow[];
}

// Generate a deck: detect insights, rank by interestingness, narrate, persist. A Redis
// cache (fail-open) keyed by the dataset's content hash + narrator skips re-detection on
// a repeat generation; a Redis outage simply recomputes.
export async function generateDeck(datasetId: string): Promise<DeckResult> {
  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: { columns: { orderBy: { index: 'asc' } } },
  });
  if (!dataset) throw new HttpError(404, 'Dataset not found');

  const cacheKey = `deck:${dataset.contentHash}:${env.NARRATOR_KIND}`;
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) {
    try {
      return await persistDeck(datasetId, JSON.parse(cached) as DeckPayload, true);
    } catch {
      // corrupt cache entry — fall through and recompute
    }
  }

  const rows = (dataset.rows as Record<string, string>[]) ?? [];
  const frame = buildFrame(
    rows,
    dataset.columns.map((c) => ({ name: c.name, inferredType: c.inferredType })),
  );
  const narrator = narratorFor();
  const raw = runDetectors(frame, detectorConfig())
    .sort((a, b) => b.score - a.score)
    .slice(0, env.MAX_INSIGHTS);

  const payload: DeckPayload = {
    narratorKind: narrator.kind,
    insights: raw.map((ins, i) => ({
      type: ins.type,
      title: narrator.narrate(ins),
      score: ins.score,
      chartType: ins.chartType,
      chartSpec: ins.chartSpec,
      detail: ins.detail,
      columns: ins.columns,
      rank: i + 1,
    })),
  };

  if (env.DECK_CACHE_TTL_SECONDS > 0) {
    await redis
      .set(cacheKey, JSON.stringify(payload), 'EX', env.DECK_CACHE_TTL_SECONDS)
      .catch(() => undefined);
  }
  return persistDeck(datasetId, payload, false);
}

async function persistDeck(
  datasetId: string,
  payload: DeckPayload,
  cacheHit: boolean,
): Promise<DeckResult> {
  const deck = await prisma.deck.create({
    data: {
      datasetId,
      narratorKind: payload.narratorKind,
      insightCount: payload.insights.length,
      insights: {
        create: payload.insights.map((ins) => ({
          type: ins.type,
          title: ins.title,
          score: ins.score,
          chartType: ins.chartType,
          chartSpec: ins.chartSpec as Prisma.InputJsonValue,
          detail: ins.detail as Prisma.InputJsonValue,
          columns: ins.columns as Prisma.InputJsonValue,
          rank: ins.rank,
        })),
      },
    },
    include: { insights: { orderBy: { rank: 'asc' } } },
  });

  return {
    id: deck.id,
    datasetId,
    generatedAt: deck.generatedAt,
    narratorKind: deck.narratorKind,
    insightCount: deck.insightCount,
    cacheHit,
    insights: deck.insights as unknown as InsightRow[],
  };
}
