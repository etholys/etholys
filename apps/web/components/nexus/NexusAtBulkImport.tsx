'use client';

import { useCallback, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';

type Props = {
  engagementId: string;
  es: boolean;
  defaultSectorId?: string | null;
  onDone: () => void;
};

export function NexusAtBulkImport({ engagementId, es, onDone }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const runImport = useCallback(
    async (payload: string) => {
      if (!payload.trim()) return;
      setBusy(true);
      setSummary(null);
      try {
        const r = await fetch(`/api/nexus/at/engagements/${encodeURIComponent(engagementId)}/members/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: payload }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Importação falhou');
        setSummary(
          es
            ? `${d.imported} empresa(s) importada(s) · ${d.createdCount} nuevas · ${d.linkedCount} existentes`
            : `${d.imported} empresa(s) importada(s) · ${d.createdCount} novas · ${d.linkedCount} existentes`
        );
        setText('');
        onDone();
      } catch (e) {
        setSummary(e instanceof Error ? e.message : 'Erro');
      } finally {
        setBusy(false);
      }
    },
    [engagementId, es, onDone]
  );

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      setText(content);
      void runImport(content);
    };
    reader.readAsText(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) readFile(f);
      }}
      className={`rounded-xl border-2 border-dashed p-4 space-y-3 ${
        drag ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 bg-slate-50/40'
      }`}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <FileSpreadsheet className="h-4 w-4 text-teal-800" />
        {es ? 'Importar MIPYMEs beneficiarias' : 'Importar MIPYMEs beneficiárias'}
      </h3>
      <p className="text-xs text-slate-600">
        {es
          ? 'Una empresa por línea. Opcional: nombre, sigla, sector. También CSV con cabecera nombre,sigla,sector.'
          : 'Uma empresa por linha. Opcional: nome, sigla, setor. Também CSV com cabeçalho nome,sigla,setor.'}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={
          es
            ? 'Cooperativa El Sol\nPanadería Norte\nTransportes Lima;TL;transport\n…'
            : 'Cooperativa El Sol\nPadaria Norte\nTransportes Lima;TL;transport\n…'
        }
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">
          <Upload className="h-3.5 w-3.5" />
          {es ? 'Cargar CSV/TXT' : 'Carregar CSV/TXT'}
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
        <button
          type="button"
          disabled={busy || text.trim().length < 2}
          onClick={() => void runImport(text)}
          className="rounded-lg bg-teal-800 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
        >
          {busy ? (es ? 'Importando…' : 'A importar…') : es ? 'Importar lista' : 'Importar lista'}
        </button>
      </div>
      {summary && <p className="text-xs text-teal-900">{summary}</p>}
    </div>
  );
}
