// Runs before any app module is imported (jest setupFiles). Local Postgres/Redis defaults;
// ports MUST match scripts/local-services.sh and d2agentdesk-ci.yml.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://agentdesk:agentdesk@localhost:5440/agentdesk?schema=public';
// Prisma's schema references directUrl, and the CLI errors if the variable is merely
// undefined — even though nothing here uses a pooler. Default it to DATABASE_URL.
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6387';
