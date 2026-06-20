import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { runSync } from '../engine/sync';

const app = createApp();
const api = request(app);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function clearDb() {
  await prisma.auditEntry.deleteMany();
  await prisma.syncRun.deleteMany();
  await prisma.fieldMapping.deleteMany();
  await prisma.syncFlow.deleteMany();
  await prisma.externalRecord.deleteMany();
  await prisma.connector.deleteMany();
}

beforeAll(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('SyncBridge end-to-end', () => {
  let sourceId = '';
  let targetId = '';
  let flowId = '';

  it('creates two connectors', async () => {
    const src = await api.post('/api/connectors').send({ name: 'Acme CRM', kind: 'mock_crm' });
    expect(src.status).toBe(201);
    sourceId = src.body.id;

    const tgt = await api.post('/api/connectors').send({ name: 'Ops Sheet', kind: 'mock_sheet' });
    expect(tgt.status).toBe(201);
    targetId = tgt.body.id;
  });

  it('seeds the source with 3 records', async () => {
    const res = await api
      .post(`/api/connectors/${sourceId}/seed`)
      .send({
        records: [
          { externalId: 'c1', data: { name: 'ada', score: '10' } },
          { externalId: 'c2', data: { name: 'alan', score: '20' } },
          { externalId: 'c3', data: { name: 'grace', score: '30' } },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.seeded).toBe(3);
  });

  it('creates a flow with mappings (uppercase name, number score)', async () => {
    const res = await api.post('/api/flows').send({
      name: 'CRM → Sheet',
      sourceConnectorId: sourceId,
      targetConnectorId: targetId,
      conflictStrategy: 'source_wins',
      mappings: [
        { sourceField: 'name', targetField: 'Name', transform: 'uppercase' },
        { sourceField: 'score', targetField: 'Score', transform: 'number' },
      ],
    });
    expect(res.status).toBe(201);
    flowId = res.body.id;
    expect(res.body.mappings).toHaveLength(2);
  });

  it('first sync creates 3 mapped records', async () => {
    const runId = await runSync(flowId, 'manual');
    const run = await api.get(`/api/runs/${runId}`);
    expect(run.status).toBe(200);
    expect(run.body.status).toBe('success');
    expect(run.body.recordsRead).toBe(3);
    expect(run.body.recordsUpserted).toBe(3);
    expect(run.body.entries.every((e: { action: string }) => e.action === 'created')).toBe(true);

    // Verify the transform actually applied on the target side.
    const records = await api.get(`/api/connectors/${targetId}/records`);
    const c1 = records.body.find((r: { externalId: string }) => r.externalId === 'c1');
    expect(c1.data).toEqual({ Name: 'ADA', Score: 10 });
  });

  it('re-sync is idempotent (all skipped)', async () => {
    const runId = await runSync(flowId, 'manual');
    const run = await api.get(`/api/runs/${runId}`);
    expect(run.body.recordsUpserted).toBe(0);
    expect(run.body.recordsSkipped).toBe(3);
  });

  it('a changed source record produces exactly one update', async () => {
    await api
      .post(`/api/connectors/${sourceId}/seed`)
      .send({ records: [{ externalId: 'c1', data: { name: 'ada-byron', score: '11' } }] });

    const runId = await runSync(flowId, 'manual');
    const run = await api.get(`/api/runs/${runId}`);
    expect(run.body.recordsUpserted).toBe(1);
    expect(run.body.recordsSkipped).toBe(2);
    const updated = run.body.entries.find((e: { externalId: string }) => e.externalId === 'c1');
    expect(updated.action).toBe('updated');
  });

  it('a both-sides change is a conflict, resolved source_wins', async () => {
    await sleep(10);
    // External change on the TARGET side…
    await api
      .post(`/api/connectors/${targetId}/seed`)
      .send({ records: [{ externalId: 'c2', data: { Name: 'CHANGED-ON-TARGET', Score: 20 } }] });
    // …and a competing change on the SOURCE side.
    await api
      .post(`/api/connectors/${sourceId}/seed`)
      .send({ records: [{ externalId: 'c2', data: { name: 'alan-turing', score: '22' } }] });

    const runId = await runSync(flowId, 'manual');
    const run = await api.get(`/api/runs/${runId}`);
    expect(run.body.recordsConflicted).toBe(1);

    const entry = run.body.entries.find((e: { externalId: string }) => e.externalId === 'c2');
    expect(entry.action).toBe('conflict_resolved');
    expect(entry.detail).toContain('source won');

    // source_wins → target overwritten with the mapped source payload.
    const records = await api.get(`/api/connectors/${targetId}/records`);
    const c2 = records.body.find((r: { externalId: string }) => r.externalId === 'c2');
    expect(c2.data).toEqual({ Name: 'ALAN-TURING', Score: 22 });
  });

  it('rejects a flow whose source connector is missing', async () => {
    const res = await api.post('/api/flows').send({
      name: 'bad',
      sourceConnectorId: 'nope',
      targetConnectorId: targetId,
    });
    expect(res.status).toBe(400);
  });
});
