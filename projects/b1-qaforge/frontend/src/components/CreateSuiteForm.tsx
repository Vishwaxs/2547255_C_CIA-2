import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export function CreateSuiteForm() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: api.createSuite,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suites'] });
      setName(''); setBaseUrl(''); setDesc(''); setOpen(false); setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
      >
        + New Suite
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm max-w-lg">
      <h3 className="font-semibold text-slate-800 mb-4">Create Test Suite</h3>
      <div className="space-y-3">
        <input
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Suite name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Base URL * (e.g. https://api.example.com)"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <input
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => mut.mutate({ name, baseUrl, description: desc })}
          disabled={!name || !baseUrl || mut.isPending}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {mut.isPending ? 'Creating…' : 'Create'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
