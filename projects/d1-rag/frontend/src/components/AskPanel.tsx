import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import type { QueryResult } from '../types';

export function AskPanel() {
  const [question, setQuestion] = useState('');
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.05);
  const [result, setResult] = useState<QueryResult | null>(null);

  const ask = useMutation({
    mutationFn: () => api.ask({ question, topK, threshold }),
    onSuccess: setResult,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) ask.mutate();
  };

  return (
    <div className="grid grid-cols-[1fr] gap-6 max-w-3xl mx-auto">
      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Ask a question about your documents
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What does a 404 status code mean?"
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
        <div className="flex items-end gap-4 mt-3">
          <label className="text-xs text-slate-500">
            top-K
            <input
              type="number"
              min={1}
              max={50}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="ml-2 w-16 border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-slate-500">
            threshold
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="ml-2 w-20 border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={ask.isPending || !question.trim()}
            className="ml-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            {ask.isPending ? 'Thinking…' : 'Ask'}
          </button>
        </div>
        {ask.isError && (
          <p className="text-xs text-rose-600 mt-2">{(ask.error as Error).message}</p>
        )}
      </form>

      {result && <AnswerCard result={result} />}
    </div>
  );
}

// Render the answer text, turning [n] markers into clickable chips that scroll to the
// matching retrieved chunk below.
function AnswerBody({ answer }: { answer: string }) {
  const parts = answer.split(/(\[\d+\])/g);
  return (
    <p className="text-sm text-slate-800 leading-relaxed">
      {parts.map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        if (!m) return <span key={i}>{part}</span>;
        const marker = m[1];
        return (
          <button
            key={i}
            onClick={() => {
              const el = document.getElementById(`cite-${marker}`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el?.classList.add('ring-2', 'ring-indigo-400');
              setTimeout(() => el?.classList.remove('ring-2', 'ring-indigo-400'), 1200);
            }}
            className="align-super text-[10px] font-bold text-indigo-600 hover:text-indigo-800 mx-0.5"
          >
            [{marker}]
          </button>
        );
      })}
    </p>
  );
}

function AnswerCard({ result }: { result: QueryResult }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {result.refused ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            ungrounded — refused
          </span>
        ) : (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
            grounded answer
          </span>
        )}
        {result.cacheHit && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
            cache hit
          </span>
        )}
        <span className="text-xs text-slate-400 ml-auto">
          top score {result.topScore !== null ? result.topScore.toFixed(3) : '—'} ·{' '}
          {result.latencyMs} ms · {result.embedderKind}/{result.generatorKind}
        </span>
      </div>

      <AnswerBody answer={result.answer} />

      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Retrieved chunks ({result.retrieved.length}) — what the answer was grounded in
        </h3>
        <ul className="space-y-2">
          {result.retrieved.map((r) => {
            // Find the citation marker (if any) that points at this chunk.
            const cite = result.citations.find((c) => c.chunkId === r.chunkId);
            return (
              <li
                key={r.chunkId}
                id={cite ? `cite-${cite.marker}` : undefined}
                className={`rounded-lg border p-3 text-xs transition ${
                  r.cited ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-slate-400">#{r.rank}</span>
                  <span className="font-semibold text-slate-700">{r.documentTitle}</span>
                  <span className="text-slate-400">score {r.score.toFixed(3)}</span>
                  {r.cited && cite && (
                    <span className="ml-auto text-[10px] font-bold text-indigo-600">
                      cited [{cite.marker}]
                    </span>
                  )}
                </div>
                <p className="text-slate-600 leading-snug line-clamp-3">{r.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
