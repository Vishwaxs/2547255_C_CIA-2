import type { LinkDto, LinkStats } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface CreateLinkInput {
  targetUrl: string;
  customAlias?: string;
}

export const api = {
  listLinks: () => fetch(`${BASE}/api/links`).then((r) => handle<LinkDto[]>(r)),

  createLink: (input: CreateLinkInput) =>
    fetch(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => handle<LinkDto>(r)),

  stats: (code: string) => fetch(`${BASE}/api/links/${code}/stats`).then((r) => handle<LinkStats>(r)),
};
