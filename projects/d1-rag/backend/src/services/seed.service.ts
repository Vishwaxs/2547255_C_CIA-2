import { ingestDocument } from './index.service';

// A small built-in demo corpus on four distinct topics, so a fresh clone can ask a
// question and get a cited answer immediately — and an off-topic question clearly
// demonstrates the refusal path. Kept short and self-contained (no external files).
export const SEED_DOCUMENTS: { title: string; text: string }[] = [
  {
    title: 'Redis Caching',
    text:
      'Redis is an in-memory key-value store often used as a cache in front of a slower database. ' +
      'The cache-aside pattern checks Redis first and falls back to the database on a miss, then ' +
      'writes the value back into Redis with a time-to-live so it expires automatically. ' +
      'Because Redis keeps data in memory, reads are typically served in well under a millisecond. ' +
      'A good cache key encodes everything that changes the result so stale entries are never returned.',
  },
  {
    title: 'Postgres Indexing',
    text:
      'PostgreSQL uses indexes to avoid scanning an entire table when answering a query. ' +
      'A B-tree index is the default and is ideal for equality and range lookups on a column. ' +
      'Adding an index speeds up reads but slows down writes, because every insert must also update the index. ' +
      'The EXPLAIN command shows whether a query uses an index scan or a sequential scan. ' +
      'Composite indexes cover queries that filter on several columns at once.',
  },
  {
    title: 'HTTP Status Codes',
    text:
      'HTTP status codes tell the client how a request was handled. ' +
      'A 200 means success, while a 201 means a new resource was created. ' +
      'A 404 means the requested resource was not found, and a 429 means the client has sent too many requests. ' +
      'Codes in the 500 range indicate the server failed to handle an otherwise valid request. ' +
      'A 302 redirects the client to a different location.',
  },
  {
    title: 'Git Branching',
    text:
      'A branch in Git is a lightweight movable pointer to a commit. ' +
      'Creating a feature branch lets you work without disturbing the main branch. ' +
      'Merging brings the changes from one branch into another, and a rebase replays commits on top of a new base. ' +
      'A merge conflict happens when two branches change the same lines and Git cannot decide automatically. ' +
      'Pushing publishes your local branch to a remote so others can see it.',
  },
];

export async function seedCorpus(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const doc of SEED_DOCUMENTS) {
    const result = await ingestDocument({ title: doc.title, text: doc.text, source: 'seed' });
    if (result.created) created++;
    else skipped++;
  }
  return { created, skipped };
}
