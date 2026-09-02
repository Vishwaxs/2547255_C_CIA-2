// A detector produces a structured RawInsight (the maths). A Narrator turns that into a
// plain-English headline. This is the swap seam: the deterministic TemplateNarrator backs
// it offline; a real LLMNarrator would write richer prose from the same `detail` with no
// change to the detectors or the deck pipeline.

export interface RawInsight {
  type: string;
  score: number; // interestingness in [0,1], used for ranking
  chartType: 'line' | 'bar' | 'scatter' | 'histogram';
  chartSpec: unknown; // pre-aggregated data + encoding for the frontend chart
  detail: Record<string, unknown>; // the numbers the headline is built from
  columns: string[];
}

export interface Narrator {
  readonly kind: string;
  narrate(insight: RawInsight): string;
}

export const NARRATOR_KINDS = ['template', 'llm'] as const;
export type NarratorKind = (typeof NARRATOR_KINDS)[number];
