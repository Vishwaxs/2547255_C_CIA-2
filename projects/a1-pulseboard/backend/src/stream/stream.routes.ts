import { Router, Request, Response } from 'express';
import { addClient, removeClient, tickOnce, sseFrame } from './broadcaster';

export const streamRouter = Router();

// GET /api/stream — Server-Sent Events. Sends an immediate snapshot on connect (so a
// client always gets at least one frame even if the broadcast loop is off), then the
// shared broadcaster pushes subsequent snapshots.
streamRouter.get('/', async (req: Request, res: Response) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering
  });
  res.flushHeaders();
  res.write(sseFrame('hello', { ok: true }));

  try {
    res.write(sseFrame('snapshot', await tickOnce()));
  } catch {
    // ignore — the broadcaster will retry
  }

  addClient(res);
  req.on('close', () => {
    removeClient(res);
    res.end();
  });
});
