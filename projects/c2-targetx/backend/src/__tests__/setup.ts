// Runs before any app module is imported (jest setupFiles). Local Postgres/Redis defaults;
// ports MUST match scripts/local-services.sh and c2targetx-ci.yml.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://targetx:targetx@localhost:5439/targetx?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6386';
