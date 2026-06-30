import { TemplateNarrator } from '../ai/templateNarrator';
import { LLMNarrator } from '../ai/llmNarrator';
import { RawInsight } from '../ai/narrator';

const base = (over: Partial<RawInsight>): RawInsight => ({
  type: 'trend',
  score: 1,
  chartType: 'line',
  chartSpec: {},
  detail: {},
  columns: [],
  ...over,
});

describe('TemplateNarrator', () => {
  const n = new TemplateNarrator();
  it('narrates a trend with direction + percent', () => {
    const s = n.narrate(base({ type: 'trend', detail: { measure: 'revenue', pctChange: 50, start: 'Jan', end: 'Jun' } }));
    expect(s).toBe('revenue rose 50% from Jan to Jun');
  });
  it('narrates a negative trend as a fall', () => {
    const s = n.narrate(base({ type: 'trend', detail: { measure: 'revenue', pctChange: -20, start: 'Jan', end: 'Jun' } }));
    expect(s).toContain('fell 20%');
  });
  it('narrates correlation strength + direction', () => {
    const s = n.narrate(base({ type: 'correlation', detail: { columnX: 'a', columnY: 'b', r: 0.85 } }));
    expect(s).toContain('strongly positively correlated');
  });
  it('narrates an outlier', () => {
    const s = n.narrate(base({ type: 'outliers', detail: { column: 'rev', count: 1, maxValue: 9999, multipleOfMedian: 8 } }));
    expect(s).toContain('1 outlier');
  });
  it('narrates a dominant category', () => {
    const s = n.narrate(base({ type: 'dominant_category', detail: { column: 'region', value: 'North', share: 50 } }));
    expect(s).toBe('North dominates region at 50% of rows');
  });
});

describe('LLMNarrator (stub)', () => {
  it('throws synchronously instead of attempting a network call', () => {
    expect(() => new LLMNarrator().narrate(base({}))).toThrow(/API key|offline/i);
  });
});
