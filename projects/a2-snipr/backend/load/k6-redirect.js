// k6 load test for the Snipr redirect hot path.
//
//   1. Seed a link via the API.
//   2. Hammer GET /:code (the cached redirect) and assert latency + error-rate
//      thresholds — these FAIL the run (non-zero exit) if breached, so the same
//      script can gate a CI job.
//
// Run:
//   BASE_URL=http://localhost:4000 k6 run load/k6-redirect.js
//
// The numbers quoted in the README are whatever THIS script reports on the
// author's machine — never borrowed.

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export const options = {
  scenarios: {
    redirects: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 20 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    // p95 redirect latency must stay under 50ms; <1% of requests may be non-302.
    http_req_duration: ['p(95)<50'],
    redirect_errors: ['rate<0.01'],
  },
};

import { Rate } from 'k6/metrics';
const redirectErrors = new Rate('redirect_errors');

// setup() runs once: create a link and hand its code to the VUs.
export function setup() {
  const res = http.post(
    `${BASE_URL}/api/links`,
    JSON.stringify({ targetUrl: 'https://example.com/k6-load-target' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'seed link created': (r) => r.status === 201 });
  return { code: res.json('code') };
}

export default function (data) {
  // redirects: false so k6 records the 302 itself rather than following it.
  const res = http.get(`${BASE_URL}/${data.code}`, { redirects: 0 });
  const ok = check(res, { 'status is 302': (r) => r.status === 302 });
  redirectErrors.add(!ok);
  sleep(0.1);
}
