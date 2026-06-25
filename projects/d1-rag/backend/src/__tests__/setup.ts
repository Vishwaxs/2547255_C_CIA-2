// Runs before any app module is imported (jest setupFiles).
// Pins the offline AI implementations so tests never need an API key or network,
// and provides local defaults for the dev Postgres/Redis. These DATABASE_URL /
// REDIS_URL ports MUST match both scripts/local-services.sh and d1rag-ci.yml.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.EMBEDDER_KIND = process.env.EMBEDDER_KIND || 'tfidf';
process.env.GENERATOR_KIND = process.env.GENERATOR_KIND || 'extractive';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://d1rag:d1rag@localhost:5435/d1rag?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6382';
