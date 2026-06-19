// QAForge execution engine.
// Fetches a suite's test cases, runs them concurrently (bounded by p-limit),
// evaluates assertions, and persists Run + RunResult rows.

import axios, { AxiosError } from 'axios';
import pLimit from 'p-limit';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { evaluateAssertions, Assertion } from './assertions';

export async function triggerRun(suiteId: string): Promise<string> {
  const suite = await prisma.suite.findUnique({
    where: { id: suiteId },
    include: { cases: true },
  });
  if (!suite) throw Object.assign(new Error('Suite not found'), { statusCode: 404 });

  const run = await prisma.run.create({
    data: { suiteId, triggeredBy: 'manual', totalTests: suite.cases.length },
  });

  // Run async so the HTTP response returns immediately with the run id.
  executeRun(run.id, suite).catch((err: Error) =>
    console.error(`[runner] run ${run.id} failed:`, err.message),
  );

  return run.id;
}

async function executeRun(
  runId: string,
  suite: Awaited<ReturnType<typeof prisma.suite.findUniqueOrThrow>> & {
    cases: Array<{
      id: string;
      name: string;
      method: string;
      path: string;
      headers: unknown;
      body: unknown;
      assertions: unknown;
    }>;
  },
): Promise<void> {
  const limit = pLimit(env.RUN_CONCURRENCY);

  let passed = 0;
  let failed = 0;

  await Promise.all(
    suite.cases.map((tc) =>
      limit(async () => {
        const start = Date.now();
        let statusCode: number | undefined;
        let pass = false;
        let failReason: string | undefined;

        try {
          const response = await axios.request({
            method: tc.method as string,
            url: `${suite.baseUrl}${tc.path}`,
            headers: (tc.headers as Record<string, string>) ?? {},
            data: tc.body ?? undefined,
            timeout: suite.timeoutMs,
            validateStatus: () => true, // never throw on HTTP status
          });

          statusCode = response.status;
          const assertions = (tc.assertions as Assertion[]) ?? [];
          const result = evaluateAssertions(
            {
              status: response.status,
              headers: response.headers as Record<string, string>,
              data: response.data,
            },
            assertions,
          );
          pass = result.pass;
          failReason = result.failReason;
        } catch (err) {
          const axErr = err as AxiosError;
          failReason = axErr.message ?? 'Request failed';
        }

        const durationMs = Date.now() - start;

        await prisma.runResult.create({
          data: {
            runId,
            testCaseId: tc.id,
            status: pass ? 'pass' : 'fail',
            durationMs,
            statusCode,
            failReason: pass ? null : (failReason ?? 'unknown'),
          },
        });

        if (pass) passed++;
        else failed++;
      }),
    ),
  );

  await prisma.run.update({
    where: { id: runId },
    data: { completedAt: new Date(), passed, failed },
  });
}
