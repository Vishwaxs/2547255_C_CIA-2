import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export function HistoryPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data: queries } = useQuery({ queryKey: ['queries'], queryFn: api.listQueries });

  return (
    <div className="grid grid-cols-[360px_1fr] gap-6">
      <aside>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent questions</h2>
        {queries && queries.length === 0 && (
          <p className="text-sm text-slate-400">No questions asked yet.</p>
        )}
        <ul className="space-y-2">
          {queries?.map((q) => (
            <li key={q.id}>
              <button
                onClick={() => setSelected(q.id)}
                className={`w-full text-left bg-white border rounded-lg p-3 shadow-sm hover:border-indigo-300 ${
                  selected === q.id ? 'border-indigo-400' : 'border-slate-200'
                }`}
              >
                <p className="text-sm text-slate-800 truncate">{q.question}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      q.refused
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {q.refused ? 'refused' : 'answered'}
                  </span>
                  {q.cacheHit && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">
                      cache
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    top {q.topScore !== null ? q.topScore.toFixed(2) : '—'} · {q.latencyMs}ms
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section>
        {selected ? (
          <QueryDetail id={selected} />
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            Select a question to see its retrieval audit.
          </div>
        )}
      </section>
    </div>
  );
}

function QueryDetail({ id }: { id: string }) {
  const { data } = useQuery({ queryKey: ['query', id], queryFn: () => api.getQuery(id) });
  if (!data) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">{data.question}</p>
        <p className="text-sm text-slate-600 mt-2">{data.answer}</p>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Retrieval audit — every chunk considered, ranked by score
        </h3>
        <ul className="space-y-2">
          {data.retrievals.map((r) => (
            <li
              key={r.id}
              className={`rounded-lg border p-3 text-xs ${
                r.cited ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-slate-400">#{r.rank}</span>
                <span className="font-semibold text-slate-700">{r.chunk.document.title}</span>
                <span className="text-slate-400">score {r.score.toFixed(3)}</span>
                {r.cited ? (
                  <span className="ml-auto text-[10px] font-bold text-indigo-600">cited</span>
                ) : (
                  <span className="ml-auto text-[10px] text-slate-400">not cited</span>
                )}
              </div>
              <p className="text-slate-600 leading-snug line-clamp-2">{r.chunk.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
