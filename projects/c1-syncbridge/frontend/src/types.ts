export type ConnectorKind = 'mock_crm' | 'mock_sheet' | 'mock_slack';
export type ConflictStrategy = 'source_wins' | 'target_wins' | 'newest_wins';
export type TransformName = 'none' | 'uppercase' | 'lowercase' | 'trim' | 'number' | 'date_iso';

export interface Connector {
  id: string;
  name: string;
  kind: ConnectorKind;
  config: Record<string, unknown>;
  createdAt: string;
  recordCount: number;
}

export interface ExternalRecord {
  id: string;
  connectorId: string;
  externalId: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

export interface ConnectorRef {
  id: string;
  name: string;
  kind: ConnectorKind;
}

export interface FieldMapping {
  id: string;
  flowId: string;
  sourceField: string;
  targetField: string;
  transform: TransformName;
}

export interface RunSummary {
  id: string;
  flowId: string;
  trigger: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'success' | 'partial' | 'failed';
  recordsRead: number;
  recordsUpserted: number;
  recordsSkipped: number;
  recordsConflicted: number;
}

export interface FlowListItem {
  id: string;
  name: string;
  sourceConnector: ConnectorRef;
  targetConnector: ConnectorRef;
  schedule: string | null;
  enabled: boolean;
  conflictStrategy: ConflictStrategy;
  lastSyncedAt: string | null;
  mappingCount: number;
  lastRun: RunSummary | null;
  createdAt: string;
}

export interface FlowDetail {
  id: string;
  name: string;
  sourceConnector: ConnectorRef;
  targetConnector: ConnectorRef;
  schedule: string | null;
  enabled: boolean;
  conflictStrategy: ConflictStrategy;
  lastSyncedAt: string | null;
  createdAt: string;
  mappings: FieldMapping[];
  runs: RunSummary[];
}

export interface AuditEntry {
  id: string;
  externalId: string;
  action: 'created' | 'updated' | 'skipped' | 'conflict_resolved' | 'failed';
  sourcePayload: Record<string, unknown>;
  mappedPayload: Record<string, unknown>;
  detail: string | null;
  createdAt: string;
}

export interface RunDetail extends RunSummary {
  flow: { id: string; name: string; conflictStrategy: ConflictStrategy };
  entries: AuditEntry[];
}

export interface MappingInput {
  sourceField: string;
  targetField: string;
  transform: TransformName;
}

export interface CreateFlowInput {
  name: string;
  sourceConnectorId: string;
  targetConnectorId: string;
  schedule?: string | null;
  conflictStrategy: ConflictStrategy;
  mappings: MappingInput[];
}
