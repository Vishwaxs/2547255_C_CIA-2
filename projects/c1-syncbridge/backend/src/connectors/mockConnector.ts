import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { Connector, ExternalRecordDTO } from './connector';

// A Connector backed by the ExternalRecord table. Each connector instance owns
// the rows tagged with its connectorId, so two MockConnectors behave like two
// independent external systems that SyncBridge keeps in sync.
export class MockConnector implements Connector {
  constructor(
    public readonly kind: string,
    private readonly connectorId: string,
  ) {}

  async list(): Promise<ExternalRecordDTO[]> {
    const rows = await prisma.externalRecord.findMany({
      where: { connectorId: this.connectorId },
      orderBy: { externalId: 'asc' },
    });
    return rows.map(toDTO);
  }

  async findByExternalId(externalId: string): Promise<ExternalRecordDTO | null> {
    const row = await prisma.externalRecord.findUnique({
      where: { connectorId_externalId: { connectorId: this.connectorId, externalId } },
    });
    return row ? toDTO(row) : null;
  }

  async upsert(
    externalId: string,
    data: Record<string, unknown>,
  ): Promise<'created' | 'updated'> {
    const existing = await prisma.externalRecord.findUnique({
      where: { connectorId_externalId: { connectorId: this.connectorId, externalId } },
    });
    await prisma.externalRecord.upsert({
      where: { connectorId_externalId: { connectorId: this.connectorId, externalId } },
      create: {
        connectorId: this.connectorId,
        externalId,
        data: data as Prisma.InputJsonValue,
      },
      update: { data: data as Prisma.InputJsonValue },
    });
    return existing ? 'updated' : 'created';
  }
}

function toDTO(row: {
  externalId: string;
  data: Prisma.JsonValue;
  updatedAt: Date;
}): ExternalRecordDTO {
  return {
    externalId: row.externalId,
    data: (row.data ?? {}) as Record<string, unknown>,
    updatedAt: row.updatedAt,
  };
}
