export interface DatasetListItem {
  id: string;
  name: string;
  source: string;
  rowCount: number;
  columnCount: number;
  deckCount: number;
  createdAt: string;
}

export interface ColumnProfile {
  id: string;
  name: string;
  index: number;
  inferredType: string;
  nullCount: number;
  distinctCount: number;
  stats: Record<string, unknown>;
}

export interface DatasetDetail {
  id: string;
  name: string;
  source: string;
  rowCount: number;
  columnCount: number;
  createdAt: string;
  columns: ColumnProfile[];
  sampleRows: Record<string, string>[];
}

export interface ChartSpec {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
  xLabel?: string;
  yLabel?: string;
}

export interface Insight {
  id: string;
  type: string;
  title: string;
  score: number;
  chartType: 'line' | 'bar' | 'scatter' | 'histogram';
  chartSpec: ChartSpec;
  detail: Record<string, unknown>;
  columns: string[];
  rank: number;
}

export interface Deck {
  id: string;
  datasetId: string;
  generatedAt: string;
  narratorKind: string;
  insightCount: number;
  cacheHit?: boolean;
  insights: Insight[];
}

export interface Stats {
  datasetCount: number;
  deckCount: number;
  insightCount: number;
  avgInsightsPerDeck: number;
  insightsByType: { type: string; count: number }[];
}
