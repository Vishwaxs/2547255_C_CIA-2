import { env } from '../config/env';
import { processDue } from '../services/dispatch.service';

// The dispatcher loop: on each tick, process every delivery that has come due (initial
// sends and retries whose backoff has elapsed). Errors in a tick are swallowed so one bad
// cycle never stops the loop. Gated by START_WORKER (off in tests, which drive processDue
// directly with an explicit `now`).
export function startDispatcher(): NodeJS.Timeout {
  return setInterval(() => {
    void processDue().catch((e) => console.error('[dispatcher]', (e as Error).message));
  }, env.DISPATCH_INTERVAL_MS);
}
