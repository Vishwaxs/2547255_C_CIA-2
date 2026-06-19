import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { LinkDto } from '../types';

export function CreateLinkForm() {
  const queryClient = useQueryClient();
  const [targetUrl, setTargetUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [created, setCreated] = useState<LinkDto | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.createLink({
        targetUrl: targetUrl.trim(),
        customAlias: customAlias.trim() || undefined,
      }),
    onSuccess: (link) => {
      setCreated(link);
      setTargetUrl('');
      setCustomAlias('');
      void queryClient.invalidateQueries({ queryKey: ['links'] });
    },
  });

  const copy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Create a short link</h2>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-slate-600">Destination URL</span>
          <input
            type="url"
            required
            placeholder="https://example.com/a/very/long/link"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>
        <label className="sm:w-48">
          <span className="mb-1 block text-sm font-medium text-slate-600">Custom alias (optional)</span>
          <input
            type="text"
            placeholder="my-link"
            value={customAlias}
            onChange={(e) => setCustomAlias(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Shortening…' : 'Shorten'}
        </button>
      </form>

      {mutation.isError && (
        <p className="mt-3 text-sm text-red-600">{(mutation.error as Error).message}</p>
      )}

      {created && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <a
            href={created.shortUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm text-blue-700 hover:underline"
          >
            {created.shortUrl}
          </a>
          <button
            onClick={copy}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-white"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </section>
  );
}
