'use client';

import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';

export function ForgeBulkInvite({ courseId }: { courseId: string }) {
  const ft = useForgeT();
  const locale = useForgeLocale();
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const runImport = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    setSummary(null);
    const res = await fetch(`/api/forge/courses/${courseId}/invite-learners/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: text, locale }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert(d.error || 'Error');
      return;
    }
    setSummary(ft('forge.bulk.summary', { ok: d.ok ?? 0, total: d.total ?? 0 }));
    setCsv('');
  }, [courseId, ft, locale]);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setCsv(text);
      void runImport(text);
    };
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.name.endsWith('.csv') || f.name.endsWith('.txt')) readFile(f);
    else alert(ft('forge.bulk.fileType'));
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={`rounded-xl border-2 border-dashed p-4 space-y-3 transition ${
        drag ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50/50'
      }`}
    >
      <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <FileSpreadsheet className="h-4 w-4" />
        {ft('forge.bulk.csv')}
      </h4>
      <p className="text-xs text-slate-500">{ft('forge.bulk.drag')} — email,nombre</p>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
        <Upload className="h-4 w-4" />
        {ft('forge.bulk.chooseCsv')}
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f);
          }}
        />
      </label>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={4}
        placeholder={'email@institucion.edu,Nombre\nemail2@...'}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => runImport(csv)}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-50"
      >
        {busy ? ft('forge.bulk.importing') : ft('forge.bulk.import')}
      </button>
      {summary && <p className="text-sm text-emerald-700 font-medium">{summary}</p>}
    </div>
  );
}
