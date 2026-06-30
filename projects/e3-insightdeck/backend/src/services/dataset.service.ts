import crypto from 'crypto';
import { Prisma, Dataset } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { parseCsv } from '../engine/parseCsv';
import { inferColumnType } from '../engine/infer';
import { profileColumn } from '../engine/profile';
import { buildSeedCsv } from '../engine/seedData';
import { HttpError } from '../middleware/errorHandler';

export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export interface IngestResult {
  dataset: Dataset;
  created: boolean;
}

// Ingest a CSV: dedupe by content hash, parse, infer each column's type, profile it,
// and persist the dataset + column profiles + raw rows. The deck is generated separately.
export async function ingestDataset(input: {
  name: string;
  csv: string;
  source: string;
}): Promise<IngestResult> {
  const contentHash = sha256(input.csv);
  const existing = await prisma.dataset.findFirst({ where: { contentHash } });
  if (existing) return { dataset: existing, created: false };

  const parsed = parseCsv(input.csv);
  if (parsed.headers.length === 0) throw new HttpError(400, 'CSV has no header row');
  if (parsed.rows.length === 0) throw new HttpError(400, 'CSV has no data rows');

  const columns = parsed.headers.map((name, index) => {
    const values = parsed.rows.map((r) => r[name] ?? '');
    const inferredType = inferColumnType(values);
    const profile = profileColumn(values, inferredType);
    return {
      name,
      index,
      inferredType,
      nullCount: profile.nullCount,
      distinctCount: profile.distinctCount,
      stats: profile.stats as Prisma.InputJsonValue,
    };
  });

  const dataset = await prisma.dataset.create({
    data: {
      name: input.name,
      source: input.source,
      contentHash,
      rowCount: parsed.rows.length,
      columnCount: parsed.headers.length,
      rows: parsed.rows as unknown as Prisma.InputJsonValue,
      columns: { create: columns },
    },
  });
  return { dataset, created: true };
}

export async function deleteDataset(id: string): Promise<boolean> {
  const existing = await prisma.dataset.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.dataset.delete({ where: { id } }); // cascades to columns + decks + insights
  return true;
}

export async function seedDataset(): Promise<IngestResult> {
  return ingestDataset({ name: 'Q1–Q2 Sales (demo)', csv: buildSeedCsv(), source: 'seed' });
}
