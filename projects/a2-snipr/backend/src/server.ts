import { createApp } from './app';
import { env } from './config/env';
import { startFlushLoop, stopFlushLoop, flushClicks } from './services/clickBuffer';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[snipr] listening on :${env.PORT} (${env.NODE_ENV})`);
  startFlushLoop();
});

// Graceful shutdown: stop accepting connections, stop the flush timer, drain any
// clicks still buffered in Redis, then close DB/cache connections cleanly.
async function shutdown(signal: string) {
  console.log(`[snipr] ${signal} received, shutting down...`);
  stopFlushLoop();
  server.close();
  try {
    await flushClicks();
  } catch (err) {
    console.error('[shutdown] final flush failed:', (err as Error).message);
  }
  await prisma.$disconnect().catch(() => undefined);
  redis.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
