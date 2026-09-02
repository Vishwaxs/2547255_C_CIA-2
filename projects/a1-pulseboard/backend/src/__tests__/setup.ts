// Runs before any app module is imported (jest setupFiles). Disables background
// intervals and provides local Postgres/Redis defaults. These ports MUST match both
// scripts/local-services.sh and a1pulseboard-ci.yml.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.START_STREAM = 'false';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://pulseboard:pulseboard@localhost:5437/pulseboard?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6384';
