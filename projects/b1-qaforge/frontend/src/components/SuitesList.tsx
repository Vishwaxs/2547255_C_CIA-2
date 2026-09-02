import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { SuiteListItem } from '../types';

function PassBadge({ passed, total }: { passed: number; total: number }) {
  if (total === 0) return <span className="text-xs text-slate-400">no runs</span>;
  const pct = Math.round((passed / total) * 100);
  const colour = pct === 100 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colour}`}>{pct}%</span>;
}

interface Props {
  onSelect: (id: string) => void;
  selectedId: string | null;
}

export function SuitesList({ onSelect, selectedId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['suites'],
    queryFn: api.listSuites,
    refetchInterval: 5000,
  });

  if (isLoading) return <p className="text-slate-500 text-sm">Loading suites…</p>;
  if (error) return <p className="text-red-500 text-sm">Failed to load suites.</p>;
  if (!data?.length) return <p className="text-slate-400 text-sm">No suites yet — create one above.</p>;

  return (
    <div className="space-y-2">
      {data.map((s: SuiteListItem) => (
        <div
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`cursor-pointer border rounded-xl p-4 transition-colors ${
            selectedId === s.id
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800 text-sm">{s.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.baseUrl}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">{s.caseCount} cases</span>
              {s.lastRun && (
                <PassBadge passed={s.lastRun.passed} total={s.lastRun.totalTests} />
              )}
              {!s.lastRun && <span className="text-xs text-slate-400">no runs</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
