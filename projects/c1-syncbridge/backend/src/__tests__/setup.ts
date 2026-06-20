// Runs before any app module is imported (jest setupFiles).
// Forces inline mode so flow CRUD never touches Redis, and provides local
// defaults for the dev Postgres/Redis when the env doesn't already set them.
process.env.START_WORKER = 'false';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://syncbridge:syncbridge@localhost:5434/syncbridge?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6381';
