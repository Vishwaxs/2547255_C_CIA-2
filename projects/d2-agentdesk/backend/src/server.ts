import 'dotenv/config';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[agentdesk] listening on :${env.PORT} (planner=${env.PLANNER_KIND})`);
});

async function shutdown() {
  console.log('[agentdesk] shutting down');
  server.close(async () => {
    await prisma.$disconnect().catch(() => undefined);
    redis.disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
