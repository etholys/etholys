'use client';

import { useRef, useState } from 'react';
import { Upload, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  IMPORT_SECTION_LABELS,
  type ImportSectionKey,
} from '@/lib/siep/import-section-prompts';
import { normalizeMilestonesPartial } from '@/lib/siep/import-activities';

type Props = {
  section: ImportSectionKey;
  /** JSON stringificado da secção actual (opcional, ajuda a IA) */
  context?: unknown;
  mode?: 'preview' | 'project';
  projectId?: string;
  onApplied?: (partial: Record<string, unknown>, mode: 'replace' | 'append') => void;
  onError?: (message: string) => void;
  className?: string;
};

export function SectionReimportBar({
  section,
  context,
  mode = 'preview',
  projectId,
  onApplied,
  onError,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [mergeMode, setMergeMode] = useState<'replace' | 'append'>('replace');
  const [loading, setLoading] = useState(false);
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  const run = async () => {
    if (!files.length) {
      onError?.('Seleccione un archivo o foto');
      return;
    }
    setLoading(true);
    setLastMsg(null);
    try {
      const fd = new FormData();
      fd.set('section', section);
      fd.set('mode', mergeMode);
      if (context) fd.set('context', JSON.stringify(context));
      files.forEach((f) => fd.append('files', f));

      const url =
        mode === 'project' && projectId
          ? `/api/projects/${projectId}/import-section`
          : '/api/import/analyze-section';

      const res = await fetch(url, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error([data.error, data.detail].filter(Boolean).join('\n') || 'Erro na re-análise');
      }

      if (mode === 'preview') {
        onApplied?.(data.partial || {}, mergeMode);
        const norm = section === 'milestones' ? normalizeMilestonesPartial(data.partial || {}) : null;
        const extra = norm ? ` — ${norm.activities.length} actividad(es), ${norm.milestones.length} hito(s)` : '';
        setLastMsg(`Secção actualizada a partir de ${(data.filesProcessed || []).join(', ')}${extra}`);
      } else {
        onApplied?.(data.partial || {}, mergeMode);
        setLastMsg(
          `${data.applied ?? 0} registo(s) ${mergeMode === 'replace' ? 'substituídos' : 'adicionados'} — ${IMPORT_SECTION_LABELS[section]}`,
        );
      }
      setFiles([]);
      if (inputRef.current) inputRef.current.value = '';
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro inesperado';
      onError?.(msg);
      setLastMsg(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-indigo-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Corrigir só esta secção com IA
          </p>
          <p className="text-xs text-indigo-700/80 mt-0.5 max-w-xl">
            Suba de novo a planilha, PDF ou <strong>foto</strong> do {IMPORT_SECTION_LABELS[section].toLowerCase()}.
            A IA re-extrai apenas esta parte — ideal quando os nomes ou valores saíram errados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mergeMode}
            onChange={(e) => setMergeMode(e.target.value as 'replace' | 'append')}
            className="text-xs rounded-lg border border-indigo-200 bg-white px-2 py-1.5"
          >
            <option value="replace">Substituir tudo nesta secção</option>
            <option value="append">Adicionar ao existente</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 bg-white text-sm text-indigo-700 cursor-pointer hover:bg-indigo-50">
          <Upload className="w-4 h-4" />
          {files.length ? `${files.length} archivo(s)` : 'Elegir archivo / foto'}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) setFiles(Array.from(e.target.files));
            }}
          />
        </label>
        {files.map((f) => (
          <span key={f.name} className="text-[10px] bg-white border border-indigo-100 rounded-full px-2 py-1 text-indigo-800 truncate max-w-[180px]">
            {f.name}
          </span>
        ))}
        <button
          type="button"
          disabled={loading || !files.length}
          onClick={run}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'A analisar…' : 'Re-importar secção'}
        </button>
      </div>

      {lastMsg && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{lastMsg}</p>}
    </div>
  );
}
