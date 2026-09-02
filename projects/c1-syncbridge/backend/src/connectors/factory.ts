import { Connector } from './connector';
import { MockConnector } from './mockConnector';

// Resolve a Connector implementation for a stored connector row. Today every
// kind maps to a MockConnector; this factory is where real OAuth-backed
// connectors (HubSpotConnector, GoogleSheetsConnector, …) would be wired in.
export function connectorFor(row: { id: string; kind: string }): Connector {
  switch (row.kind) {
    case 'mock_crm':
    case 'mock_sheet':
    case 'mock_slack':
      return new MockConnector(row.kind, row.id);
    default:
      throw Object.assign(new Error(`Unsupported connector kind: ${row.kind}`), {
        statusCode: 400,
      });
  }
}
