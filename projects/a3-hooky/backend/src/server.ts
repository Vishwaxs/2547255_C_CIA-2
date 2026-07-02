import 'dotenv/config';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const app = createApp();

// The dispatcher loop is started here (gated by START_WORKER) once it exists — wired in a
// later phase. Tests set START_WORKER=false and drive processDue() directly.

const server = app.listen(env.PORT, () => {
  console.log(`[hooky] listening on :${env.PORT} (worker=${env.START_WORKER}, transport=${env.TRANSPORT})`);
});

async function shutdown() {
  console.log('[hooky] shutting down');
  server.close(async () => {
    await prisma.$disconnect().catch(() => undefined);
    redis.disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
