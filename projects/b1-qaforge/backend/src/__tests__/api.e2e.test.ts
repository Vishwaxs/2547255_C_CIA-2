/**
 * Integration tests for QAForge API.
 *
 * Uses a local Express stub server as the test target (instead of an external URL)
 * so tests are fully self-contained in an air-gapped environment.
 *
 * Requires: DATABASE_URL + REDIS_URL env vars pointing to live Postgres + Redis.
 */

import request from 'supertest';
import express from 'express';
import http from 'http';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

// ---- local stub target server -----------------------------------------------
// Returns 200 for /pass, 418 for /fail, toggles /flaky between 200 and 418.
let flakyToggle = false;

function createTargetServer(): http.Server {
  const app = express();
  app.get('/pass', (_req, res) => res.json({ ok: true }));
  app.get('/fail', (_req, res) => res.status(418).json({ error: "I'm a teapot" }));
  app.get('/flaky', (_req, res) => {
    flakyToggle = !flakyToggle;
    res.status(flakyToggle ? 200 : 418).json({ flaky: true });
  });
  return app.listen(0); // random port
}

// ---- test setup -------------------------------------------------------------
let targetServer: http.Server;
let targetUrl: string;
let suiteId: string;
let passCaseId: string;
let failCaseId: string;
let flakyCaseId: string;

const app = createApp();

beforeAll(async () => {
  targetServer = createTargetServer();
  const addr = targetServer.address() as { port: number };
  targetUrl = `http://127.0.0.1:${addr.port}`;

  // Create a test suite pointing at the stub
  const suiteRes = await request(app)
    .post('/api/suites')
    .send({ name: 'Integration Test Suite', baseUrl: targetUrl })
    .expect(201);
  suiteId = suiteRes.body.id as string;

  // Add test cases
  const [passRes, failRes, flakyRes] = await Promise.all([
    request(app).post(`/api/suites/${suiteId}/cases`).send({
      name: 'Always pass',
      path: '/pass',
      assertions: [{ type: 'status', expected: 200 }, { type: 'jsonBody', field: 'ok', op: 'truthy' }],
    }).expect(201),
    request(app).post(`/api/suites/${suiteId}/cases`).send({
      name: 'Always fail',
      path: '/fail',
      assertions: [{ type: 'status', expected: 200 }],
    }).expect(201),
    request(app).post(`/api/suites/${suiteId}/cases`).send({
      name: 'Flaky (alternates 200/418)',
      path: '/flaky',
      assertions: [{ type: 'status', expected: 200 }],
    }).expect(201),
  ]);
  passCaseId = passRes.body.id as string;
  failCaseId = failRes.body.id as string;
  flakyCaseId = flakyRes.body.id as string;
});

afterAll(async () => {
  if (suiteId) {
    await prisma.suite.delete({ where: { id: suiteId } }).catch(() => {});
  }
  await prisma.$disconnect();
  redis.disconnect();
  targetServer.close();
});

async function waitForRun(runId: string, maxWaitMs = 15000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const r = await request(app).get(`/api/runs/${runId}`);
    if (r.body.completedAt) return;
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error('Run did not complete in time');
}

// ---- tests ------------------------------------------------------------------

describe('Suite CRUD', () => {
  it('GET /api/suites returns the created suite', async () => {
    const res = await request(app).get('/api/suites').expect(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: suiteId, caseCount: 3 }),
    ]));
  });

  it('GET /api/suites/:id returns cases', async () => {
    const res = await request(app).get(`/api/suites/${suiteId}`).expect(200);
    expect(res.body.cases).toHaveLength(3);
    expect(res.body.cases.map((c: { id: string }) => c.id)).toContain(passCaseId);
  });

  it('returns 404 for unknown suite', async () => {
    await request(app).get('/api/suites/unknown-id').expect(404);
  });

  it('returns 400 for invalid create payload', async () => {
    await request(app).post('/api/suites').send({ name: 'Missing baseUrl' }).expect(400);
  });
});

describe('Run execution', () => {
  let runId: string;

  beforeAll(async () => {
    flakyToggle = false; // first flaky call → 200
    const res = await request(app)
      .post('/api/runs')
      .send({ suiteId })
      .expect(202);
    runId = res.body.id as string;
    await waitForRun(runId);
  });

  it('run returns 202 with id', () => {
    expect(runId).toBeTruthy();
  });

  it('run has correct pass/fail counts after completion', async () => {
    const res = await request(app).get(`/api/runs/${runId}`).expect(200);
    // pass=2 (always-pass + flaky first call 200), fail=1 (always-fail)
    expect(res.body.passed).toBe(2);
    expect(res.body.failed).toBe(1);
    expect(res.body.totalTests).toBe(3);
  });

  it('RunResult rows exist for each case', async () => {
    const res = await request(app).get(`/api/runs/${runId}`).expect(200);
    expect(res.body.results).toHaveLength(3);
    const statuses: Record<string, string> = {};
    for (const r of res.body.results) {
      statuses[r.testCaseId] = r.status;
    }
    expect(statuses[passCaseId]).toBe('pass');
    expect(statuses[failCaseId]).toBe('fail');
    expect(statuses[flakyCaseId]).toBe('pass'); // first call 200
  });

  it('fail case includes failReason', async () => {
    const res = await request(app).get(`/api/runs/${runId}`).expect(200);
    const failResult = res.body.results.find((r: { testCaseId: string }) => r.testCaseId === failCaseId);
    expect(failResult.failReason).toBeTruthy();
    expect(failResult.failReason).toContain('418');
  });
});

describe('Flakiness detection', () => {
  it('flakiness score is nonzero after a flipping run', async () => {
    // Run 2: flaky → 418 (fail), so flaky case flips from pass→fail → flakinessScore > 0
    flakyToggle = true; // next call → 418
    const runRes = await request(app).post('/api/runs').send({ suiteId }).expect(202);
    await waitForRun(runRes.body.id as string);

    const stats = await request(app).get(`/api/suites/${suiteId}/stats`).expect(200);
    const flakyStat = stats.body.caseStats.find(
      (c: { testCaseId: string }) => c.testCaseId === flakyCaseId,
    );
    expect(flakyStat.flakinessScore).toBeGreaterThan(0);
    expect(flakyStat.totalRuns).toBe(2);
  });

  it('stats endpoint includes passRateTrend', async () => {
    const stats = await request(app).get(`/api/suites/${suiteId}/stats`).expect(200);
    expect(stats.body.passRateTrend.length).toBeGreaterThanOrEqual(2);
  });

  it('caseStats sorted by flakinessScore descending', async () => {
    const stats = await request(app).get(`/api/suites/${suiteId}/stats`).expect(200);
    const scores = stats.body.caseStats.map((c: { flakinessScore: number }) => c.flakinessScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});
