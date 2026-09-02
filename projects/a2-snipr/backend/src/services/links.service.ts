import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { env } from '../config/env';
import { generateCode } from '../utils/codeGenerator';
import { HttpError } from '../middleware/errorHandler';

const cacheKey = (code: string) => `link:${code}`;

// Codes that must never be claimed as a custom alias because they collide with
// real routes / well-known files.
const RESERVED = new Set(['api', 'health', 'healthz', 'favicon.ico', 'robots.txt']);

export interface CreateLinkInput {
  targetUrl: string;
  customAlias?: string;
  expiresAt?: string;
}

export async function createLink(input: CreateLinkInput) {
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  if (input.customAlias) {
    const alias = input.customAlias;
    if (RESERVED.has(alias.toLowerCase())) throw new HttpError(409, 'AliasReserved');
    const existing = await prisma.link.findUnique({ where: { code: alias } });
    if (existing) throw new HttpError(409, 'AliasTaken');

    const link = await prisma.link.create({
      data: { code: alias, targetUrl: input.targetUrl, isCustom: true, expiresAt },
    });
    await primeCache(link.code, link.targetUrl, expiresAt);
    return link;
  }

  // Random code with a bounded uniqueness retry on the unique-constraint
  // violation (Prisma error P2002). At a 3.5-trillion key space a second
  // attempt is essentially never needed, but we guard it rather than assume.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const link = await prisma.link.create({
        data: { code, targetUrl: input.targetUrl, expiresAt },
      });
      await primeCache(link.code, link.targetUrl, expiresAt);
      return link;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') continue;
      throw err;
    }
  }
  throw new HttpError(500, 'CodeGenerationFailed');
}

async function primeCache(code: string, targetUrl: string, expiresAt: Date | null) {
  const ttl = cacheTtl(expiresAt);
  if (ttl > 0) await redis.set(cacheKey(code), targetUrl, 'EX', ttl);
}

// Cache TTL is the configured default, but never longer than the link's own
// time-to-expiry (so an expired link can't keep serving from cache).
function cacheTtl(expiresAt: Date | null): number {
  if (!expiresAt) return env.LINK_CACHE_TTL_SECONDS;
  const secondsToExpiry = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  return Math.min(env.LINK_CACHE_TTL_SECONDS, Math.max(0, secondsToExpiry));
}

export interface ResolveResult {
  targetUrl: string | null;
  cacheHit: boolean;
}

// The hot path. Cache-aside: try Redis first; on a miss fall back to Postgres
// and populate the cache. Returns null when the code is unknown, inactive or
// expired. Reads dwarf writes for a shortener, so the vast majority of redirects
// are served entirely from Redis.
export async function resolveCode(code: string): Promise<ResolveResult> {
  const cached = await redis.get(cacheKey(code)).catch(() => null);
  if (cached) return { targetUrl: cached, cacheHit: true };

  const link = await prisma.link.findUnique({ where: { code } });
  if (!link || !link.isActive) return { targetUrl: null, cacheHit: false };
  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
    return { targetUrl: null, cacheHit: false };
  }
  await primeCache(link.code, link.targetUrl, link.expiresAt);
  return { targetUrl: link.targetUrl, cacheHit: false };
}

export async function listLinks(limit = 50) {
  return prisma.link.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
}

export async function getLinkByCode(code: string) {
  return prisma.link.findUnique({ where: { code } });
}
