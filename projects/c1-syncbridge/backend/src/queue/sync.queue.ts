import { Queue } from 'bullmq';
import { bullConnection } from './connection';

export const SYNC_QUEUE = 'sync-jobs';

// Lazily created so importing this module never forces a Redis connection
// (tests run the engine directly with START_WORKER=false and never touch it).
let queue: Queue | null = null;

function getQueue(): Queue {
  if (!queue) queue = new Queue(SYNC_QUEUE, { connection: bullConnection() });
  return queue;
}

// Enqueue execution of an already-created run (manual / event trigger).
export async function enqueueSync(runId: string): Promise<void> {
  await getQueue().add(
    'execute',
    { runId },
    { removeOnComplete: 200, removeOnFail: 200 },
  );
}

const scheduleJobId = (flowId: string) => `sched:${flowId}`;

// Register (or replace) a cron-repeatable job for a scheduled flow.
export async function registerSchedule(flowId: string, cron: string): Promise<void> {
  await unregisterSchedule(flowId);
  await getQueue().add(
    'scheduled',
    { flowId },
    { repeat: { pattern: cron }, jobId: scheduleJobId(flowId) },
  );
}

export async function unregisterSchedule(flowId: string): Promise<void> {
  const q = getQueue();
  const repeatables = await q.getRepeatableJobs();
  for (const r of repeatables) {
    if (r.id === scheduleJobId(flowId)) {
      await q.removeRepeatableByKey(r.key);
    }
  }
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
