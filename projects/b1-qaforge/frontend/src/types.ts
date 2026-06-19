export interface SuiteListItem {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  timeoutMs: number;
  createdAt: string;
  caseCount: number;
  lastRun: RunSummary | null;
}

export interface Suite {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  timeoutMs: number;
  createdAt: string;
  cases: TestCase[];
}

export interface TestCase {
  id: string;
  suiteId: string;
  name: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  assertions: unknown[];
  createdAt: string;
}

export interface RunSummary {
  id: string;
  startedAt: string;
  completedAt: string | null;
  totalTests: number;
  passed: number;
  failed: number;
}

export interface RunDetail extends RunSummary {
  suiteId: string;
  triggeredBy: string;
  results: RunResult[];
}

export interface RunResult {
  id: string;
  runId: string;
  testCaseId: string;
  status: 'pass' | 'fail';
  durationMs: number;
  statusCode: number | null;
  failReason: string | null;
  createdAt: string;
  testCase: { id: string; name: string };
}

export interface CaseStat {
  testCaseId: string;
  name: string;
  totalRuns: number;
  passed: number;
  passRate: number;
  flakinessScore: number;
  avgDurationMs: number;
}

export interface SuiteStats {
  suiteId: string;
  suiteName: string;
  caseStats: CaseStat[];
  passRateTrend: {
    runId: string;
    startedAt: string;
    passRate: number;
    totalTests: number;
    passed: number;
    failed: number;
  }[];
}
