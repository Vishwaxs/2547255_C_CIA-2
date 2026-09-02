// The Connector interface is the swap point of the whole iPaaS.
// A MockConnector (backed by the ExternalRecord table) implements it here; a
// real HubSpot/Google Sheets/Slack connector would implement the same three
// methods over OAuth + HTTP without any change to the sync engine.

export interface ExternalRecordDTO {
  externalId: string;
  data: Record<string, unknown>;
  updatedAt: Date;
}

export interface Connector {
  readonly kind: string;

  /** Pull every record currently in the connected system (the source side). */
  list(): Promise<ExternalRecordDTO[]>;

  /** Look up a single record on the target side, or null if absent. */
  findByExternalId(externalId: string): Promise<ExternalRecordDTO | null>;

  /** Create or update a record on the target side. Returns which action ran. */
  upsert(externalId: string, data: Record<string, unknown>): Promise<'created' | 'updated'>;
}

export const CONNECTOR_KINDS = ['mock_crm', 'mock_sheet', 'mock_slack'] as const;
export type ConnectorKind = (typeof CONNECTOR_KINDS)[number];
