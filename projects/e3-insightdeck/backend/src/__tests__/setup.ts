// Runs before any app module is imported (jest setupFiles). Pins the offline narrator
// and local Postgres/Redis defaults. These DATABASE_URL / REDIS_URL ports MUST match
// both scripts/local-services.sh and e3insightdeck-ci.yml.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.NARRATOR_KIND = process.env.NARRATOR_KIND || 'template';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://insightdeck:insightdeck@localhost:5436/insightdeck?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6383';
