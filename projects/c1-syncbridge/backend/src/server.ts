import 'dotenv/config';
import type { Worker } from 'bullmq';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const app = createApp();

let worker: Worker | null = null;
if (env.START_WORKER) {
  // Imported lazily so test runs (START_WORKER=false) never open a BullMQ connection.
  const { startWorker } = require('./queue/sync.worker') as typeof import('./queue/sync.worker');
  worker = startWorker();
}

const server = app.listen(env.PORT, () => {
  console.log(`[syncbridge] listening on :${env.PORT} (worker=${env.START_WORKER})`);
});

async function shutdown() {
  console.log('[syncbridge] shutting down');
  server.close(async () => {
    if (worker) await worker.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    redis.disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
