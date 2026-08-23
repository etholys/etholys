'use client';

import { useState } from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import type { StudioCanvasState } from '@/lib/studio/types';

type Props = {
  documentId: string;
  companyId?: string;
  locale: string;
  canEdit: boolean;
  disabled?: boolean;
  onApplied: (canvas: StudioCanvasState, message: string) => void;
  labels: {
    title: string;
    subtitle: string;
    placeholder: string;
    run: string;
    presets: string;
  };
};

const PRESETS = {
  pt: [
    'Capa + secções limpas, estilo Gamma, tipografia forte',
    'Institucional com brand kit, callouts e hierarquia clara',
    'Apresentação visual para cliente: capas, destaques, pouco texto denso',
    'Relatório técnico: secções numeradas, listas, molduras subtis',
  ],
  es: [
    'Portada + secciones limpias, estilo Gamma, tipografía fuerte',
    'Institucional con brand kit, callouts y jerarquía clara',
    'Presentación visual para cliente: portadas, destacados, poco texto denso',
    'Informe técnico: secciones numeradas, listas, marcos sutiles',
  ],
  en: [
    'Cover + clean sections, Gamma style, strong typography',
    'Institutional with brand kit, callouts and clear hierarchy',
    'Client visual deck: covers, highlights, little dense text',
    'Technical report: numbered sections, lists, subtle frames',
  ],
} as const;

export function StudioDesignAiPanel({
  documentId,
  locale,
  canEdit,
  disabled,
  onApplied,
  labels,
}: Props) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMsg, setLastMsg] = useState<string | null>(null);
  const presets = locale === 'es' ? PRESETS.es : locale === 'en' ? PRESETS.en : PRESETS.pt;

  async function run(brief?: string) {
    if (!canEdit || busy) return;
    const text = (brief ?? prompt).trim();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/studio/documents/${documentId}/design-layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, locale }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      if (d.canvasState) {
        onApplied(d.canvasState, d.message || '');
        setLastMsg(d.message || null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-violet-900/40 bg-[#0f0b16] text-violet-50">
      <div className="border-b border-violet-800/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <Wand2 className="h-4 w-4 text-violet-300" />
          {labels.title}
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-violet-200/70">{labels.subtitle}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">{labels.presets}</p>
        <div className="flex flex-col gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              disabled={!canEdit || busy || disabled}
              onClick={() => {
                setPrompt(p);
                void run(p);
              }}
              className="rounded-xl border border-violet-700/50 bg-violet-950/50 px-3 py-2 text-left text-[11px] leading-snug text-violet-100 hover:border-violet-400 hover:bg-violet-900/40 disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>

        {lastMsg && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-100">
            {lastMsg}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-violet-800/50 p-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={!canEdit || busy}
          rows={3}
          placeholder={labels.placeholder}
          className="w-full resize-none rounded-xl border border-violet-700/60 bg-violet-950/80 px-3 py-2 text-sm text-violet-50 placeholder:text-violet-400/60 outline-none focus:border-violet-400"
        />
        <button
          type="button"
          disabled={!canEdit || busy || disabled}
          onClick={() => void run()}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-900/40 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {labels.run}
        </button>
      </div>
    </div>
  );
}
