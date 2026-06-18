import { Router, Request } from 'express';
import { createHash } from 'crypto';
import geoip from 'geoip-lite';
import { rateLimit, clientIp } from '../middleware/rateLimit';
import { env } from '../config/env';
import { resolveCode } from '../services/links.service';
import { bufferClick } from '../services/clickBuffer';

export const redirectRouter = Router();

const redirectLimiter = rateLimit({
  scope: 'redirect',
  windowSeconds: env.RATE_LIMIT_REDIRECT_WINDOW_SECONDS,
  max: env.RATE_LIMIT_REDIRECT_MAX,
});

redirectRouter.get('/:code', redirectLimiter, async (req, res, next) => {
  try {
    const { code } = req.params;
    const { targetUrl, cacheHit } = await resolveCode(code);
    if (!targetUrl) return res.status(404).json({ error: 'NotFound' });

    res.setHeader('X-Cache', cacheHit ? 'HIT' : 'MISS');

    // Record the click OFF the hot path — we deliberately don't await this
    // before issuing the redirect, so analytics never adds latency to the user.
    captureClick(code, req).catch((err) => console.error('[click] buffer error:', err.message));

    return res.redirect(302, targetUrl);
  } catch (err) {
    return next(err);
  }
});

async function captureClick(code: string, req: Request) {
  const ip = clientIp(req);
  const geo = ip && ip !== 'unknown' ? geoip.lookup(ip) : null;
  const ua = req.headers['user-agent'] ?? '';
  await bufferClick({
    code,
    ts: new Date().toISOString(),
    referrer: typeof req.headers.referer === 'string' ? req.headers.referer : undefined,
    country: geo?.country ?? undefined,
    // Store only a short hash of the UA — enough to dedupe/segment without
    // retaining the raw fingerprint.
    uaHash: ua ? createHash('sha256').update(ua).digest('hex').slice(0, 16) : undefined,
  });
}
