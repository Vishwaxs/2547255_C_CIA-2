// Knowledge-base relevance scoring. Pure functions, no I/O, no dependencies — which is
// what makes the interesting half of search_kb unit-testable without a database.
//
// The scoring is deliberately plain keyword overlap rather than embeddings. This project's
// whole premise is that the agent runs offline with no model API, and reaching for a vector
// model here would reintroduce exactly the dependency the planner was designed to avoid.
// What matters for the demo is that the score is *meaningful* — it has to separate "the KB
// answers this" from "it doesn't" reliably enough that the escalation path is real and not
// theatre.

export const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'by', 'for',
  'and', 'or', 'but', 'my', 'me', 'i', 'you', 'your', 'we', 'our', 'it', 'its', 'this',
  'that', 'these', 'those', 'with', 'about', 'from', 'as', 'so', 'if', 'then', 'than',
  'have', 'has', 'had', 'be', 'been', 'am', 'do', 'does', 'did', 'can', 'could', 'will',
  'would', 'should', 'shall', 'may', 'might', 'must', 'how', 'what', 'why', 'when', 'where',
  'who', 'which', 'please', 'hi', 'hello', 'thanks', 'thank', 'want', 'need', 'get', 'got',
  'not', 'no', 'yes', 'any', 'all', 'some', 'there', 'here', 'just', 'very', 'now',
]);

/** Lowercase, split on non-alphanumerics, drop 1-character fragments and stopwords. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export interface ScorableArticle {
  id: string;
  title: string;
  body: string;
  tags: string[];
}

export interface ScoredArticle {
  id: string;
  title: string;
  score: number;
  snippet: string;
  /** Which query terms actually hit. Surfaced in the trace so a reviewer can see *why*
   *  the agent believed this article was relevant, rather than trusting a bare number. */
  matchedTerms: string[];
}

/** Weights are ordered by how much signal each field carries for a short support query:
 *  a term in the title is the strongest topical signal, an explicit tag is a curated
 *  signal, and body occurrences are the weakest but most numerous. */
export const WEIGHT_TITLE = 3;
export const WEIGHT_TAG = 2;
export const WEIGHT_BODY = 1;

export function scoreArticle(
  queryTokens: string[],
  article: ScorableArticle,
): { score: number; matchedTerms: string[] } {
  const titleTokens = tokenize(article.title);
  const bodyTokens = tokenize(article.body);
  const tags = article.tags.map((t) => t.toLowerCase());

  let score = 0;
  const matchedTerms: string[] = [];

  for (const term of new Set(queryTokens)) {
    const titleHits = titleTokens.filter((t) => t === term).length;
    const bodyHits = bodyTokens.filter((t) => t === term).length;
    const tagHit = tags.includes(term) ? 1 : 0;
    const termScore = titleHits * WEIGHT_TITLE + tagHit * WEIGHT_TAG + bodyHits * WEIGHT_BODY;
    if (termScore > 0) {
      score += termScore;
      matchedTerms.push(term);
    }
  }

  return { score, matchedTerms };
}

function snippetFor(article: ScorableArticle, maxLen = 220): string {
  const firstSentence = article.body.split(/(?<=[.!?])\s+/)[0] ?? article.body;
  return firstSentence.length > maxLen
    ? `${firstSentence.slice(0, maxLen - 3).trimEnd()}...`
    : firstSentence;
}

// Ranking alone is not enough to answer from. A single incidental hit on a common word
// scores 1 and ranks first simply because nothing else matched — which is how an agent ends
// up confidently quoting an article about email addresses at someone asking about
// internships, purely because both texts contain the word "takes".
//
// So relevance and *sufficiency* are separated. rankArticles says what matched;
// meetsConfidence says whether the best match is strong enough to answer from. Two
// conditions, because they catch different failures: a minimum score rejects a lone
// glancing body hit, and a minimum number of distinct matched terms rejects one heavily
// repeated word carrying the whole score on its own.
export const DEFAULT_MIN_SCORE = 4;
export const DEFAULT_MIN_TERMS = 2;

export function meetsConfidence(
  result: ScoredArticle,
  minScore = DEFAULT_MIN_SCORE,
  minTerms = DEFAULT_MIN_TERMS,
): boolean {
  return result.score >= minScore && result.matchedTerms.length >= minTerms;
}

/** Rank articles against a query, best first. Articles that match nothing are dropped
 *  entirely rather than returned with score 0 — "no results" has to be a distinct,
 *  honest outcome, because it is what drives the agent to escalate instead of inventing
 *  an answer. */
export function rankArticles(
  query: string,
  articles: ScorableArticle[],
  topK = 3,
): ScoredArticle[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  return articles
    .map((article) => {
      const { score, matchedTerms } = scoreArticle(queryTokens, article);
      return { id: article.id, title: article.title, score, matchedTerms, snippet: snippetFor(article) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, topK);
}
