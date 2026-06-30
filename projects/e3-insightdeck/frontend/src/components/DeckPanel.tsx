import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Insight } from '../types';
import { InsightChart } from './InsightChart';

const TYPE_LABELS: Record<string, string> = {
  trend: 'Trend',
  top_categories: 'Top categories',
  correlation: 'Correlation',
  outliers: 'Outliers',
  distribution: 'Distribution',
  dominant_category: 'Dominant value',
  missingness: 'Missing data',
  segment_vs_average: 'Segment vs avg',
};

export function DeckPanel() {
  const qc = useQueryClient();
  const [datasetId, setDatasetId] = useState('');
  const { data: datasets } = useQuery({ queryKey: ['datasets'], queryFn: api.listDatasets });

  useEffect(() => {
    if (!datasetId && datasets && datasets.length > 0) setDatasetId(datasets[0].id);
  }, [datasets, datasetId]);

  const { data: deck, isError } = useQuery({
    queryKey: ['deck', datasetId],
    queryFn: () => api.getLatestDeck(datasetId),
    enabled: !!datasetId,
    retry: false,
  });

  const generate = useMutation({
    mutationFn: () => api.generateDeck(datasetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deck', datasetId] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  if (!datasets || datasets.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No datasets yet — go to <span className="font-medium">Datasets</span> and seed the demo
        or upload a CSV.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={datasetId}
          onChange={(e) => setDatasetId(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white cursor-pointer"
        >
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.rowCount} rows × {d.columnCount} cols)
            </option>
          ))}
        </select>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending || !datasetId}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg cursor-pointer transition-colors"
        >
          {generate.isPending ? 'Analyzing…' : deck ? 'Regenerate insights' : 'Generate insights'}
        </button>
        {deck && (
          <span className="text-xs text-slate-400">
            {deck.insightCount} insights · {deck.narratorKind} narrator
            {deck.cacheHit ? ' · cached' : ''}
          </span>
        )}
      </div>

      {!deck && !generate.isPending && (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
          {isError ? 'No deck yet — click “Generate insights”.' : 'Loading…'}
        </div>
      )}

      {deck && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deck.insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-mono text-slate-400">#{insight.rank}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
          {TYPE_LABELS[insight.type] ?? insight.type}
        </span>
        <span className="ml-auto text-[10px] text-slate-400">
          score {insight.score.toFixed(2)}
        </span>
      </div>
      <p className="text-sm font-medium text-slate-800 mb-3 leading-snug">{insight.title}</p>
      <InsightChart insight={insight} />
      <p className="mt-2 text-[10px] text-slate-400">{insight.columns.join(' · ')}</p>
    </div>
  );
}
