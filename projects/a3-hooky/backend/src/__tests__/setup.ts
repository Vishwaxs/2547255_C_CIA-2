// Runs before any app module is imported (jest setupFiles). Disables the dispatcher loop
// and provides local Postgres/Redis defaults. Ports MUST match scripts/local-services.sh
// and a3hooky-ci.yml.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.START_WORKER = 'false';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://hooky:hooky@localhost:5438/hooky?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6385';
