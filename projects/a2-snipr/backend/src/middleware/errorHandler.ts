import { Request, Response, NextFunction } from 'express';

// Small typed error so services can signal an HTTP status without coupling to
// Express (e.g. `throw new HttpError(409, 'AliasTaken')`).
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'NotFound' });
}

// Express recognises an error handler by its 4-argument signature, so `_next`
// must stay in the list even though it is unused.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error('[error]', err);
  return res.status(500).json({ error: 'InternalServerError' });
}
