'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';

export function ForgeLibroSearch({ courseId }: { courseId: string }) {
  const ft = useForgeT();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ snippet: string }[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search() {
    if (!q.trim()) return;
    setBusy(true);
    const res = await fetch(
      `/api/forge/courses/${courseId}/libro/search?q=${encodeURIComponent(q.trim())}`
    );
    const d = await res.json();
    setBusy(false);
    if (res.ok) {
      setHits(d.hits ?? []);
      setStatus(d.status ?? null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <Search className="h-4 w-4" />
        {ft('forge.libro.search')}
      </label>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
          placeholder="…"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void search()}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-50"
        >
          {busy ? '…' : 'OK'}
        </button>
      </div>
      {status === 'pending' && (
        <p className="text-xs text-amber-700">{ft('forge.libro.ocrPending')}</p>
      )}
      {status === 'failed' && (
        <p className="text-xs text-red-600">{ft('forge.libro.ocrFailed')}</p>
      )}
      {hits.length > 0 && (
        <ul className="space-y-2 max-h-48 overflow-y-auto text-sm text-slate-700">
          {hits.map((h, i) => (
            <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
              {h.snippet}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
