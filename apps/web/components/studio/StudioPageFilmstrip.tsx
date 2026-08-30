'use client';

import { useEffect, useRef } from 'react';
import { Crosshair, Plus } from 'lucide-react';
import type { StudioPage } from '@/lib/studio/types';
import type { PageSelectionState } from '@/lib/studio/selection-scope';

type Props = {
  pages: StudioPage[];
  activePageId: string | null;
  locale: string;
  variant?: 'write' | 'design';
  onSelect: (pageId: string) => void;
  onAddPage?: () => void;
  canEdit?: boolean;
  /** Estado de selecção IA por folha (miniatura). */
  pageAiSelection?: Record<string, PageSelectionState>;
  onToggleAiPage?: (pageId: string) => void;
};

function t(locale: string, pt: string, es: string, en: string): string {
  return locale === 'es' ? es : locale === 'en' ? en : pt;
}

/** Filmstrip estilo Word (write) / Gamma (design) — navegação folha-a-folha. */
export function StudioPageFilmstrip({
  pages,
  activePageId,
  locale,
  variant = 'design',
  onSelect,
  onAddPage,
  canEdit,
  pageAiSelection,
  onToggleAiPage,
}: Props) {
  const sorted = pages.slice().sort((a, b) => a.order - b.order);
  const activeIdx = sorted.findIndex((p) => p.id === activePageId);
  const isWrite = variant === 'write';
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activePageId]);

  const shell = isWrite
    ? 'border-t border-stone-300/80 bg-[#f0ebe3]'
    : 'border-t border-violet-900/50 bg-[#0a0610]';
  const labelCls = isWrite
    ? 'text-[10px] font-bold uppercase tracking-wider text-stone-500'
    : 'text-[10px] font-bold uppercase tracking-wider text-violet-400';
  const counterCls = isWrite ? 'text-[10px] text-stone-500' : 'text-[10px] text-violet-500';
  const pageLabel = isWrite
    ? t(locale, 'Folhas', 'Hojas', 'Pages')
    : t(locale, 'Slides', 'Slides', 'Slides');
  const addLabel = isWrite
    ? t(locale, 'Folha', 'Hoja', 'Page')
    : t(locale, 'Slide', 'Slide', 'Slide');

  return (
    <div className={`shrink-0 px-3 py-2 ${shell}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <p className={labelCls}>{pageLabel}</p>
        <p className={counterCls}>
          {(activeIdx >= 0 ? activeIdx : 0) + 1} / {sorted.length}
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sorted.map((page, idx) => {
          const active = page.id === activePageId;
          const preview = page.blocks
            .slice()
            .sort((a, b) => a.order - b.order)
            .find((b) => b.kind === 'heading' || b.text.trim());
          const label =
            preview?.kind === 'heading'
              ? preview.text.replace(/^#+\s*/, '').slice(0, 40)
              : preview?.text.slice(0, 40) || page.title;

          const aiSel = pageAiSelection?.[page.id] || 'none';

          return (
            <div key={page.id} className="group relative shrink-0" style={{ width: '112px' }}>
            <button
              ref={active ? activeThumbRef : undefined}
              type="button"
              onClick={() => onSelect(page.id)}
              className={`w-full rounded-lg border transition ${
                active
                  ? isWrite
                    ? 'border-orange-400 bg-white ring-2 ring-orange-300/50'
                    : 'border-fuchsia-400 bg-violet-900/80 ring-2 ring-fuchsia-400/40'
                  : aiSel === 'full'
                    ? isWrite
                      ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-300/60'
                      : 'border-orange-400 bg-violet-900/60 ring-2 ring-orange-400/50'
                    : aiSel === 'partial'
                      ? isWrite
                        ? 'border-orange-300 bg-white ring-1 ring-orange-200'
                        : 'border-orange-500/70 bg-violet-950/50 ring-1 ring-orange-400/40'
                      : isWrite
                        ? 'border-stone-300/80 bg-white/60 hover:border-orange-300 hover:bg-white'
                        : 'border-violet-800/60 bg-violet-950/40 hover:border-violet-500'
              }`}
              title={label || page.title || `${idx + 1}`}
            >
              <div
                className={`flex aspect-[210/297] w-full flex-col overflow-hidden rounded-t-lg p-1.5 ${
                  isWrite ? 'bg-white' : 'bg-white'
                }`}
              >
                <p className="line-clamp-4 text-[8px] leading-tight text-slate-700">{label || '—'}</p>
              </div>
              <p
                className={`px-1.5 py-1 text-center text-[10px] font-semibold ${
                  isWrite ? 'text-stone-600' : 'text-violet-200'
                }`}
              >
                {idx + 1}
              </p>
            </button>
            {canEdit && onToggleAiPage && (
              <button
                type="button"
                title={t(locale, 'Seleccionar folha para IA', 'Seleccionar hoja para IA', 'Select page for AI')}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleAiPage(page.id);
                }}
                className={`absolute right-1 top-1 rounded-md p-0.5 shadow-sm ${
                  aiSel === 'full'
                    ? 'bg-orange-600 text-white'
                    : aiSel === 'partial'
                      ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-300'
                      : 'bg-white/90 text-stone-600 ring-1 ring-stone-200 opacity-0 group-hover:opacity-100'
                }`}
              >
                <Crosshair className="h-3 w-3" />
              </button>
            )}
            </div>
          );
        })}
        {canEdit && onAddPage && (
          <button
            type="button"
            onClick={onAddPage}
            className={`flex h-[88px] w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed ${
              isWrite
                ? 'border-stone-400/60 text-stone-500 hover:border-orange-400 hover:bg-orange-50/50'
                : 'border-violet-700/60 text-violet-400 hover:border-violet-400 hover:bg-violet-950/60'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span className="mt-0.5 text-[9px] font-semibold">{addLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
