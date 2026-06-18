import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';

interface RateLimitOptions {
  scope: string; // namespaces the key, e.g. 'create' vs 'redirect'
  windowSeconds: number;
  max: number;
}

// Extract the real client IP. `trust proxy` is enabled on the app, so when
// running behind a proxy (Render/Vercel) X-Forwarded-For holds the originating
// address; we take the first hop.
export function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

// Redis fixed-window rate limiter. One counter key per (scope, ip, time-bucket);
// INCR returns the new count and we set the TTL on the first hit so the bucket
// expires on its own. O(1) per request. The known trade-off is burst tolerance
// at window boundaries (up to ~2x near an edge) — acceptable for abuse control
// and documented in DECISIONS.md. If Redis is unavailable we fail OPEN so a
// cache outage can't take down all traffic.
export function rateLimit(opts: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = clientIp(req);
    const bucket = Math.floor(Date.now() / 1000 / opts.windowSeconds);
    const key = `rl:${opts.scope}:${ip}:${bucket}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, opts.windowSeconds);
      }
      res.setHeader('X-RateLimit-Limit', String(opts.max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, opts.max - count)));

      if (count > opts.max) {
        res.setHeader('Retry-After', String(opts.windowSeconds));
        return res.status(429).json({ error: 'RateLimitExceeded' });
      }
      return next();
    } catch (err) {
      console.error('[rateLimit] redis error, failing open:', (err as Error).message);
      return next();
    }
  };
}
