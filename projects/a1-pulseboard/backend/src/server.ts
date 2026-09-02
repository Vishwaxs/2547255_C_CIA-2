import 'dotenv/config';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const app = createApp();

let rollupTimer: NodeJS.Timeout | null = null;
if (env.START_STREAM) {
  // Started only outside tests (START_STREAM=false) so no background intervals run there.
  const { startBroadcaster } = require('./stream/broadcaster') as typeof import('./stream/broadcaster');
  const { startRollupJob } = require('./jobs/rollup.job') as typeof import('./jobs/rollup.job');
  startBroadcaster();
  rollupTimer = startRollupJob();
}

const server = app.listen(env.PORT, () => {
  console.log(`[pulseboard] listening on :${env.PORT} (stream=${env.START_STREAM})`);
});

async function shutdown() {
  console.log('[pulseboard] shutting down');
  server.close(async () => {
    if (rollupTimer) clearInterval(rollupTimer);
    await prisma.$disconnect().catch(() => undefined);
    redis.disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
