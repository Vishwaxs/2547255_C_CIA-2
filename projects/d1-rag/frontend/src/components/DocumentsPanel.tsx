import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { DocumentDetail } from '../types';

export function DocumentsPanel() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: documents } = useQuery({ queryKey: ['documents'], queryFn: api.listDocuments });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['documents'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const create = useMutation({
    mutationFn: () => api.createDocument({ title, text }),
    onSuccess: () => {
      setTitle('');
      setText('');
      invalidate();
    },
  });
  const seed = useMutation({ mutationFn: api.seedDocuments, onSuccess: invalidate });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: invalidate,
  });

  return (
    <div className="grid grid-cols-[360px_1fr] gap-6">
      <aside className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && text.trim()) create.mutate();
          }}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3"
        >
          <h2 className="text-sm font-semibold text-slate-700">Add a document</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste document text…"
            rows={6}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={create.isPending || !title.trim() || !text.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg"
            >
              {create.isPending ? 'Indexing…' : 'Add & index'}
            </button>
            <button
              type="button"
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
              className="text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
            >
              {seed.isPending ? 'Seeding…' : 'Seed demo corpus'}
            </button>
          </div>
          {create.isError && (
            <p className="text-xs text-rose-600">{(create.error as Error).message}</p>
          )}
        </form>
      </aside>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Corpus ({documents?.length ?? 0} documents)
        </h2>
        {documents && documents.length === 0 && (
          <p className="text-sm text-slate-400">
            No documents yet. Add one, or click “Seed demo corpus”.
          </p>
        )}
        <ul className="space-y-2">
          {documents?.map((d) => (
            <li key={d.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{d.title}</p>
                  <p className="text-xs text-slate-400">
                    {d.source} · {d.chunkCount} chunks · {d.charCount} chars
                  </p>
                </div>
                <button
                  onClick={() => setOpenId(openId === d.id ? null : d.id)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  {openId === d.id ? 'Hide' : 'View chunks'}
                </button>
                <button
                  onClick={() => remove.mutate(d.id)}
                  className="text-xs font-medium text-rose-500 hover:text-rose-700"
                >
                  Delete
                </button>
              </div>
              {openId === d.id && <ChunkList id={d.id} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ChunkList({ id }: { id: string }) {
  const { data } = useQuery<DocumentDetail>({
    queryKey: ['document', id],
    queryFn: () => api.getDocument(id),
  });
  if (!data) return <p className="text-xs text-slate-400 mt-2">Loading…</p>;
  return (
    <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
      {data.chunks.map((c) => (
        <li key={c.id} className="text-xs text-slate-600 bg-slate-50 rounded p-2">
          <span className="font-mono text-slate-400 mr-2">
            #{c.index} [{c.charStart}–{c.charEnd}]
          </span>
          {c.text}
        </li>
      ))}
    </ul>
  );
}
