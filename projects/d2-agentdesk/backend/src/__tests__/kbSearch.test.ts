import {
  tokenize,
  scoreArticle,
  rankArticles,
  meetsConfidence,
  ScorableArticle,
  WEIGHT_TITLE,
  WEIGHT_TAG,
  WEIGHT_BODY,
} from '../engine/kbSearch';

const article: ScorableArticle = {
  id: 'a1',
  title: 'Resetting your password',
  body: 'Open Settings and select Reset password. The reset link expires in 30 minutes.',
  tags: ['password', 'login'],
};

describe('tokenize', () => {
  it('lowercases, splits on punctuation and drops stopwords', () => {
    expect(tokenize('How do I reset MY password?')).toEqual(['reset', 'password']);
  });

  it('drops single characters and empty fragments', () => {
    expect(tokenize('a b -- cd!')).toEqual(['cd']);
  });

  it('returns nothing for a query made entirely of stopwords', () => {
    expect(tokenize('how do I get the')).toEqual([]);
  });
});

describe('scoreArticle', () => {
  it('weights a title hit above a tag hit above a body hit', () => {
    const titleOnly = scoreArticle(['resetting'], article).score;
    const tagOnly = scoreArticle(['login'], article).score;
    expect(titleOnly).toBe(WEIGHT_TITLE);
    expect(tagOnly).toBe(WEIGHT_TAG);
    expect(titleOnly).toBeGreaterThan(tagOnly);
    expect(tagOnly).toBeGreaterThan(WEIGHT_BODY);
  });

  it('accumulates across fields and counts repeated body occurrences', () => {
    // "password": title(3) + tag(2) + body x1(1) = 6
    const { score, matchedTerms } = scoreArticle(['password'], article);
    expect(score).toBe(WEIGHT_TITLE + WEIGHT_TAG + WEIGHT_BODY);
    expect(matchedTerms).toEqual(['password']);
  });

  it('reports only the terms that actually hit', () => {
    const { matchedTerms } = scoreArticle(['password', 'kangaroo'], article);
    expect(matchedTerms).toEqual(['password']);
  });

  it('does not stem — a different inflection is not a match', () => {
    expect(scoreArticle(['resets'], article).score).toBe(0);
  });
});

describe('rankArticles', () => {
  const other: ScorableArticle = {
    id: 'a2',
    title: 'Shipping times',
    body: 'Standard delivery takes 3-5 business days.',
    tags: ['shipping'],
  };

  it('orders best-first and drops zero-score articles entirely', () => {
    const out = rankArticles('reset my password', [article, other]);
    expect(out.map((r) => r.id)).toEqual(['a1']);
  });

  it('returns nothing when the query is all stopwords', () => {
    expect(rankArticles('how do I', [article, other])).toEqual([]);
  });

  it('respects topK', () => {
    expect(rankArticles('password shipping', [article, other], 1)).toHaveLength(1);
  });
});

describe('meetsConfidence', () => {
  const weak = { id: 'x', title: 't', score: 1, snippet: '', matchedTerms: ['takes'] };
  const strong = { id: 'y', title: 't', score: 9, snippet: '', matchedTerms: ['reset', 'password'] };

  it('rejects a lone incidental body hit', () => {
    expect(meetsConfidence(weak)).toBe(false);
  });

  it('rejects a high score carried by a single repeated term', () => {
    expect(meetsConfidence({ ...strong, matchedTerms: ['password'] })).toBe(false);
  });

  it('accepts a strong multi-term match', () => {
    expect(meetsConfidence(strong)).toBe(true);
  });
});
