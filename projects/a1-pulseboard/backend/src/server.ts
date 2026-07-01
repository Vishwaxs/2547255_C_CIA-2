import 'dotenv/config';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const app = createApp();

// The SSE broadcaster + rollup job are started here (gated by START_STREAM) once they
// exist — wired in a later phase. Tests set START_STREAM=false so no intervals run.

const server = app.listen(env.PORT, () => {
  console.log(`[pulseboard] listening on :${env.PORT} (stream=${env.START_STREAM})`);
});

async function shutdown() {
  console.log('[pulseboard] shutting down');
  server.close(async () => {
    await prisma.$disconnect().catch(() => undefined);
    redis.disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
