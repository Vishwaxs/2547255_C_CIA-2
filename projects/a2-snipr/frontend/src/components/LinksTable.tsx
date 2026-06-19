import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

interface Props {
  selectedCode: string | null;
  onSelect: (code: string) => void;
}

export function LinksTable({ selectedCode, onSelect }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['links'],
    queryFn: api.listLinks,
  });

  if (isLoading) return <p className="text-slate-500">Loading links…</p>;
  if (isError) return <p className="text-red-600">{(error as Error).message}</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No links yet — create one above.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Code</th>
            <th className="px-4 py-3 font-medium">Destination</th>
            <th className="px-4 py-3 text-right font-medium">Clicks</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {data.map((link) => (
            <tr
              key={link.code}
              className={`border-b border-slate-100 last:border-0 ${
                selectedCode === link.code ? 'bg-blue-50' : ''
              }`}
            >
              <td className="px-4 py-3 font-mono text-blue-700">/{link.code}</td>
              <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={link.targetUrl}>
                {link.targetUrl}
              </td>
              <td className="px-4 py-3 text-right font-semibold">{link.clickCount}</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onSelect(link.code)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                >
                  Analytics
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
