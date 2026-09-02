import 'dotenv/config';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const app = createApp();

let dispatchTimer: NodeJS.Timeout | null = null;
if (env.START_WORKER) {
  // Started only outside tests (START_WORKER=false), which drive processDue() directly.
  const { startDispatcher } = require('./jobs/dispatcher.job') as typeof import('./jobs/dispatcher.job');
  dispatchTimer = startDispatcher();
}

const server = app.listen(env.PORT, () => {
  console.log(`[hooky] listening on :${env.PORT} (worker=${env.START_WORKER}, transport=${env.TRANSPORT})`);
});

async function shutdown() {
  console.log('[hooky] shutting down');
  server.close(async () => {
    if (dispatchTimer) clearInterval(dispatchTimer);
    await prisma.$disconnect().catch(() => undefined);
    redis.disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
