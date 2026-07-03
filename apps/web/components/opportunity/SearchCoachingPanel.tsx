'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { Loader2, MessageSquareText, Sparkles } from 'lucide-react';

type Briefing = {
  themes: string[];
  countries: string[];
  kinds: string[];
  notes?: string;
  searchFeedback?: string;
};

export function SearchCoachingPanel({
  briefing,
  onSaved,
}: {
  briefing: Briefing;
  onSaved?: (feedback: string) => void;
}) {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [feedback, setFeedback] = useState(briefing.searchFeedback ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFeedback(briefing.searchFeedback ?? '');
  }, [briefing.searchFeedback]);

  const q = (path: string) =>
    `${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`;

  const save = useCallback(async () => {
    if (!companyId) return;
    setBusy(true);
    setSaved(false);
    try {
      const payload = { ...briefing, searchFeedback: feedback.trim() || undefined };
      const r = await fetch(q('/api/opportunity/briefing'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefing: payload }),
      });
      if (!r.ok) throw new Error('Erro ao guardar');
      setSaved(true);
      onSaved?.(feedback.trim());
    } finally {
      setBusy(false);
    }
  }, [briefing, companyId, feedback, onSaved]);

  if (!companyId) return null;

  const hints = [
    t('Prefiro multilaterais (Banco Mundial, UE…)', 'Prefiero multilaterales', 'Prefer multilaterals'),
    t('Evitar microcrédito local', 'Evitar microcrédito local', 'Avoid local microcredit'),
    t('Foco em agricultura / cadeias', 'Foco en agricultura', 'Focus on agriculture'),
  ];

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-600" />
        <h3 className="text-sm font-semibold text-gray-900">
          {t('Afinar a busca', 'Afinar la búsqueda', 'Refine the search')}
        </h3>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        {t(
          'Diga à IA o que priorizar ou evitar — aplica-se a todas as varreduras seguintes.',
          'Dígale a la IA qué priorizar o evitar — se aplica a todos los barridos.',
          'Tell the AI what to prioritize or avoid — applies to all future scans.',
        )}
      </p>

      <textarea
        value={feedback}
        onChange={(e) => {
          setFeedback(e.target.value);
          setSaved(false);
        }}
        rows={4}
        placeholder={t(
          'Ex.: mais fundos bilaterais na África; menos consultorias pequenas; priorizar >500k USD…',
          'Ej.: más fondos bilaterales en África; menos consultorías pequeñas…',
          'E.g. more bilateral funds in Africa; fewer small consultancies; prioritize >500k USD…',
        )}
        className="mt-3 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {hints.map((hint) => (
          <button
            key={hint}
            type="button"
            onClick={() => {
              setFeedback((prev) => (prev.trim() ? `${prev.trim()}\n${hint}` : hint));
              setSaved(false);
            }}
            className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] text-violet-800 hover:bg-violet-100"
          >
            + {hint}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageSquareText className="h-4 w-4" />
        )}
        {saved
          ? t('Guardado ✓', 'Guardado ✓', 'Saved ✓')
          : t('Guardar instruções', 'Guardar instrucciones', 'Save instructions')}
      </button>
    </section>
  );
}
