export interface DocumentListItem {
  id: string;
  title: string;
  source: string;
  charCount: number;
  chunkCount: number;
  createdAt: string;
}

export interface ChunkDetail {
  id: string;
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  tokenCount: number;
}

export interface DocumentDetail extends DocumentListItem {
  chunks: ChunkDetail[];
}

export interface Citation {
  marker: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  text: string;
  charStart: number;
  charEnd: number;
  score: number;
}

export interface RetrievedItem {
  rank: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  score: number;
  cited: boolean;
  text: string;
}

export interface QueryResult {
  id: string;
  question: string;
  answer: string;
  refused: boolean;
  cacheHit: boolean;
  topScore: number | null;
  topK: number;
  threshold: number;
  latencyMs: number;
  embedderKind: string;
  generatorKind: string;
  citations: Citation[];
  retrieved: RetrievedItem[];
}

export interface QueryListItem {
  id: string;
  question: string;
  refused: boolean;
  cacheHit: boolean;
  topScore: number | null;
  topK: number;
  threshold: number;
  latencyMs: number;
  embedderKind: string;
  generatorKind: string;
  createdAt: string;
}

export interface RetrievalAudit {
  id: string;
  score: number;
  rank: number;
  cited: boolean;
  chunk: {
    id: string;
    index: number;
    text: string;
    charStart: number;
    charEnd: number;
    document: { id: string; title: string };
  };
}

export interface QueryDetailData extends QueryListItem {
  answer: string;
  retrievals: RetrievalAudit[];
}

export interface Stats {
  totalQueries: number;
  answered: number;
  refused: number;
  answeredRate: number;
  cacheHits: number;
  cacheHitRate: number;
  avgLatencyMs: number;
  avgTopScore: number;
  documentCount: number;
  chunkCount: number;
  queriesPerDay: { day: string; total: number; answered: number }[];
  topCitedDocuments: { title: string; citations: number }[];
}
