// SyncBridge execution engine. Decoupled from the queue: the BullMQ worker and
// the manual-trigger route both drive it. Tests call runSync() directly, so the
// engine is exercised without any Redis dependency.
//
//   createRun()  → inserts a SyncRun(running) and returns its id immediately
//   executeRun() → does the work for a given run id (called inline or by worker)
//   runSync()    → createRun + executeRun, awaited end to end (used by tests)

import { Prisma } from '@prisma/client';
import pLimit from 'p-limit';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { connectorFor } from '../connectors/factory';
import { applyMappings, MappingRule, TransformName } from './mapping';
import {
  isConflict,
  resolveConflict,
  payloadsEqual,
  ConflictStrategy,
} from './conflict';

type Trigger = 'manual' | 'scheduled' | 'event';
type AuditAction = 'created' | 'updated' | 'skipped' | 'conflict_resolved' | 'failed';

interface Counters {
  read: number;
  upserted: number;
  skipped: number;
  conflicted: number;
  failures: number;
}

export async function createRun(flowId: string, trigger: Trigger = 'manual'): Promise<string> {
  const flow = await prisma.syncFlow.findUnique({ where: { id: flowId } });
  if (!flow) throw Object.assign(new Error('Flow not found'), { statusCode: 404 });
  const run = await prisma.syncRun.create({ data: { flowId, trigger, status: 'running' } });
  return run.id;
}

export async function executeRun(runId: string): Promise<void> {
  const run = await prisma.syncRun.findUnique({ where: { id: runId } });
  if (!run) throw Object.assign(new Error('Run not found'), { statusCode: 404 });

  const flow = await prisma.syncFlow.findUnique({
    where: { id: run.flowId },
    include: { sourceConnector: true, targetConnector: true, mappings: true },
  });
  if (!flow) throw Object.assign(new Error('Flow not found'), { statusCode: 404 });

  // Snapshot the previous sync time before we touch anything on the target.
  const lastSyncedAt = flow.lastSyncedAt;
  const strategy = flow.conflictStrategy as ConflictStrategy;
  const rules: MappingRule[] = flow.mappings.map((m) => ({
    sourceField: m.sourceField,
    targetField: m.targetField,
    transform: m.transform as TransformName,
  }));

  const counts: Counters = { read: 0, upserted: 0, skipped: 0, conflicted: 0, failures: 0 };

  try {
    const source = connectorFor(flow.sourceConnector);
    const target = connectorFor(flow.targetConnector);
    const records = await source.list();
    counts.read = records.length;

    const limit = pLimit(env.SYNC_CONCURRENCY);
    await Promise.all(
      records.map((record) =>
        limit(() =>
          syncOneRecord({ runId, record, target, rules, strategy, lastSyncedAt, counts }),
        ),
      ),
    );

    const status = counts.failures > 0 ? 'partial' : 'success';
    await prisma.syncRun.update({
      where: { id: runId },
      data: {
        completedAt: new Date(),
        status,
        recordsRead: counts.read,
        recordsUpserted: counts.upserted,
        recordsSkipped: counts.skipped,
        recordsConflicted: counts.conflicted,
      },
    });
    // Mark the flow synced only on a clean pass so a partial run re-evaluates.
    if (status === 'success') {
      await prisma.syncFlow.update({ where: { id: flow.id }, data: { lastSyncedAt: new Date() } });
    }
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: runId },
      data: {
        completedAt: new Date(),
        status: 'failed',
        recordsRead: counts.read,
        recordsUpserted: counts.upserted,
        recordsSkipped: counts.skipped,
        recordsConflicted: counts.conflicted,
      },
    });
    throw err;
  }
}

export async function runSync(flowId: string, trigger: Trigger = 'manual'): Promise<string> {
  const runId = await createRun(flowId, trigger);
  await executeRun(runId);
  return runId;
}

async function syncOneRecord(args: {
  runId: string;
  record: { externalId: string; data: Record<string, unknown>; updatedAt: Date };
  target: ReturnType<typeof connectorFor>;
  rules: MappingRule[];
  strategy: ConflictStrategy;
  lastSyncedAt: Date | null;
  counts: Counters;
}): Promise<void> {
  const { runId, record, target, rules, strategy, lastSyncedAt, counts } = args;
  const mapped = applyMappings(record.data, rules);

  let action: AuditAction;
  let detail: string | undefined;

  try {
    const existing = await target.findByExternalId(record.externalId);

    if (!existing) {
      await target.upsert(record.externalId, mapped);
      action = 'created';
      counts.upserted++;
    } else if (
      isConflict({
        sourceUpdatedAt: record.updatedAt,
        targetUpdatedAt: existing.updatedAt,
        lastSyncedAt,
        mapped,
        targetData: existing.data,
      })
    ) {
      counts.conflicted++;
      const winner = resolveConflict(strategy, record.updatedAt, existing.updatedAt);
      if (winner === 'source') {
        await target.upsert(record.externalId, mapped);
        detail = `${strategy}: source won, target overwritten`;
        counts.upserted++;
      } else {
        detail = `${strategy}: target won, source change discarded`;
        counts.skipped++;
      }
      action = 'conflict_resolved';
    } else if (!payloadsEqual(mapped, existing.data)) {
      await target.upsert(record.externalId, mapped);
      action = 'updated';
      counts.upserted++;
    } else {
      action = 'skipped';
      counts.skipped++;
    }
  } catch (err) {
    action = 'failed';
    detail = (err as Error).message;
    counts.failures++;
  }

  await prisma.auditEntry.create({
    data: {
      syncRunId: runId,
      externalId: record.externalId,
      action,
      sourcePayload: record.data as Prisma.InputJsonValue,
      mappedPayload: mapped as Prisma.InputJsonValue,
      detail,
    },
  });
}
