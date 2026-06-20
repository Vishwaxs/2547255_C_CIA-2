import { Worker, Job } from 'bullmq';
import { SYNC_QUEUE } from './sync.queue';
import { bullConnection } from './connection';
import { createRun, executeRun } from '../engine/sync';

// Processes two job kinds:
//   'execute'   { runId }  — run a pre-created run (manual / event trigger)
//   'scheduled' { flowId } — a cron fire: create a fresh run, then execute it
export function startWorker(): Worker {
  const worker = new Worker(
    SYNC_QUEUE,
    async (job: Job) => {
      if (job.name === 'execute') {
        await executeRun(job.data.runId as string);
      } else if (job.name === 'scheduled') {
        const runId = await createRun(job.data.flowId as string, 'scheduled');
        await executeRun(runId);
      }
    },
    { connection: bullConnection(), concurrency: 2 },
  );

  worker.on('failed', (job, err) =>
    console.error(`[worker] job ${job?.id} failed:`, err.message),
  );
  worker.on('ready', () => console.log('[worker] ready'));
  return worker;
}
