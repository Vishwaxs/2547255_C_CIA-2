import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';
import { env } from '../config/env';
import { createLink, listLinks, getLinkByCode } from '../services/links.service';
import { getStats } from '../services/analytics.service';
import type { Link } from '@prisma/client';

export const linksRouter = Router();

// Custom aliases: 3-32 chars, URL-safe set only.
const aliasRegex = /^[A-Za-z0-9_-]{3,32}$/;

const createSchema = z.object({
  targetUrl: z.string().url().max(2048),
  customAlias: z.string().regex(aliasRegex).optional(),
  expiresAt: z.string().datetime().optional(),
});

const createLimiter = rateLimit({
  scope: 'create',
  windowSeconds: env.RATE_LIMIT_CREATE_WINDOW_SECONDS,
  max: env.RATE_LIMIT_CREATE_MAX,
});

linksRouter.post('/', createLimiter, validateBody(createSchema), async (req, res, next) => {
  try {
    const link = await createLink(req.body);
    res.status(201).json(toDto(link));
  } catch (err) {
    next(err);
  }
});

linksRouter.get('/', async (_req, res, next) => {
  try {
    const links = await listLinks();
    res.json(links.map(toDto));
  } catch (err) {
    next(err);
  }
});

linksRouter.get('/:code', async (req, res, next) => {
  try {
    const link = await getLinkByCode(req.params.code);
    if (!link) return res.status(404).json({ error: 'NotFound' });
    return res.json(toDto(link));
  } catch (err) {
    return next(err);
  }
});

linksRouter.get('/:code/stats', async (req, res, next) => {
  try {
    const stats = await getStats(req.params.code);
    if (!stats) return res.status(404).json({ error: 'NotFound' });
    return res.json(stats);
  } catch (err) {
    return next(err);
  }
});

function toDto(link: Link) {
  return {
    code: link.code,
    shortUrl: `${env.PUBLIC_BASE_URL}/${link.code}`,
    targetUrl: link.targetUrl,
    clickCount: link.clickCount,
    isCustom: link.isCustom,
    isActive: link.isActive,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
  };
}
