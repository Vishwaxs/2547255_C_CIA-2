import { Tool, ToolResult } from '../types';
import { prisma } from '../../lib/prisma';
import { cacheGet, cacheSet } from '../../lib/redis';
import { env } from '../../config/env';
import { rankArticles, meetsConfidence, ScorableArticle } from '../kbSearch';

export const KB_CACHE_KEY = 'agentdesk:kb:all';

/** The KB is small and read-mostly, and search_kb runs on every question-intent ticket,
 *  so the article set is cached rather than re-read per step. Fail-open: a Redis outage
 *  silently degrades to a Postgres read. */
async function loadArticles(): Promise<ScorableArticle[]> {
  const cached = await cacheGet<ScorableArticle[]>(KB_CACHE_KEY);
  if (cached) return cached;

  const rows = await prisma.knowledgeArticle.findMany({ orderBy: { createdAt: 'asc' } });
  const articles: ScorableArticle[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    tags: (r.tags as string[]) ?? [],
  }));
  await cacheSet(KB_CACHE_KEY, articles);
  return articles;
}

export const searchKbTool: Tool = {
  name: 'search_kb',
  description:
    'Search the support knowledge base for articles relevant to a natural-language query. Returns only matches confident enough to answer from. Input: { query: string }',
  async run(input): Promise<ToolResult> {
    const query = String(input.query ?? '').trim();
    if (!query) {
      return { ok: false, summary: 'No query supplied to search_kb.', data: { results: [] } };
    }

    const articles = await loadArticles();
    const ranked = rankArticles(query, articles, 3);
    const threshold = { minScore: env.KB_MIN_SCORE, minTerms: env.KB_MIN_TERMS };

    if (ranked.length === 0) {
      return {
        ok: false,
        summary: `Nothing in the knowledge base matched this question (searched ${articles.length} articles).`,
        data: { results: [], rejected: [], searched: articles.length, threshold },
      };
    }

    const confident = ranked.filter((r) => meetsConfidence(r, threshold.minScore, threshold.minTerms));

    // A weak match is reported as a failure, not quietly dropped. The near-miss is carried
    // in `rejected` so the trace shows what the agent considered and why it refused it —
    // "found nothing" and "found something too flimsy to trust" are different facts and a
    // reviewer should be able to tell them apart.
    if (confident.length === 0) {
      const best = ranked[0];
      return {
        ok: false,
        summary: `Best candidate "${best.title}" scored ${best.score} on [${best.matchedTerms.join(', ')}], below the confidence bar (needs score >= ${threshold.minScore} across >= ${threshold.minTerms} terms). Not answering from it.`,
        data: { results: [], rejected: ranked, searched: articles.length, threshold },
      };
    }

    return {
      ok: true,
      summary: `Matched ${confident.length} of ${articles.length} articles — best: "${confident[0].title}" (score ${confident[0].score} on [${confident[0].matchedTerms.join(', ')}]).`,
      data: { results: confident, rejected: [], searched: articles.length, threshold },
    };
  },
};
