'use client';

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
  pageAiSelection?: Record<string, PageSelectionState>;
  onToggleAiPage?: (pageId: string) => void;
};

function t(locale: string, pt: string, es: string, en: string): string {
  return locale === 'es' ? es : locale === 'en' ? en : pt;
}

function pagePreview(page: StudioPage): { title: string; snippet: string } {
  const sorted = page.blocks.slice().sort((a, b) => a.order - b.order);
  const heading = sorted.find((b) => b.kind === 'heading' && b.text.trim());
  const body = sorted.find((b) => b.text.trim() && b.kind !== 'diagram');
  const title = heading
    ? heading.text.replace(/^#+\s*/, '').trim()
    : body?.text.trim().slice(0, 80) || page.title || '';
  const snippet = body && body !== heading ? body.text.trim().replace(/\s+/g, ' ').slice(0, 120) : '';
  return { title, snippet };
}

/** Lista vertical legível — painel lateral (substitui filmstrip horizontal). */
export function StudioPagesList({
  pages,
  activePageId,
  locale,
  variant = 'write',
  onSelect,
  onAddPage,
  canEdit,
  pageAiSelection,
  onToggleAiPage,
}: Props) {
  const sorted = pages.slice().sort((a, b) => a.order - b.order);
  const activeIdx = sorted.findIndex((p) => p.id === activePageId);
  const isWrite = variant === 'write';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <p
          className={`text-[10px] font-bold uppercase tracking-wide ${
            isWrite ? 'text-stone-500' : 'text-violet-400'
          }`}
        >
          {isWrite
            ? t(locale, 'Folhas', 'Hojas', 'Pages')
            : t(locale, 'Slides', 'Slides', 'Slides')}
        </p>
        <p className={`text-[10px] font-medium ${isWrite ? 'text-stone-400' : 'text-violet-500'}`}>
          {(activeIdx >= 0 ? activeIdx : 0) + 1} / {sorted.length}
        </p>
      </div>

      <div className="max-h-[42vh] space-y-1 overflow-y-auto pr-0.5">
        {sorted.map((page, idx) => {
          const active = page.id === activePageId;
          const { title, snippet } = pagePreview(page);
          const aiSel = pageAiSelection?.[page.id] || 'none';
          const displayTitle = title || t(locale, 'Sem título', 'Sin título', 'Untitled');

          return (
            <div key={page.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(page.id)}
                className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                  active
                    ? isWrite
                      ? 'border-orange-400 bg-orange-50/80 ring-1 ring-orange-300/60'
                      : 'border-fuchsia-400/80 bg-violet-900/50 ring-1 ring-fuchsia-400/40'
                    : aiSel === 'full'
                      ? isWrite
                        ? 'border-orange-300 bg-orange-50/50'
                        : 'border-orange-400/60 bg-violet-950/40'
                      : isWrite
                        ? 'border-stone-200 bg-white hover:border-orange-300 hover:bg-stone-50'
                        : 'border-violet-800/50 bg-violet-950/30 hover:border-violet-600'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                    active
                      ? isWrite
                        ? 'bg-orange-600 text-white'
                        : 'bg-fuchsia-600 text-white'
                      : isWrite
                        ? 'bg-stone-200 text-stone-700'
                        : 'bg-violet-800 text-violet-200'
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-xs font-semibold leading-snug ${
                      isWrite ? 'text-stone-900' : 'text-violet-50'
                    }`}
                  >
                    {displayTitle}
                  </span>
                  {snippet ? (
                    <span
                      className={`mt-0.5 line-clamp-2 block text-[11px] leading-snug ${
                        isWrite ? 'text-stone-500' : 'text-violet-300/80'
                      }`}
                    >
                      {snippet}
                    </span>
                  ) : null}
                </span>
              </button>
              {canEdit && onToggleAiPage && (
                <button
                  type="button"
                  title={t(locale, 'Seleccionar folha para IA', 'Seleccionar hoja para IA', 'Select page for AI')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleAiPage(page.id);
                  }}
                  className={`absolute right-1.5 top-1.5 rounded-md p-1 ${
                    aiSel === 'full'
                      ? 'bg-orange-600 text-white'
                      : aiSel === 'partial'
                        ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-300'
                        : isWrite
                          ? 'bg-white/90 text-stone-500 opacity-0 ring-1 ring-stone-200 group-hover:opacity-100'
                          : 'bg-violet-900/90 text-violet-200 opacity-0 ring-1 ring-violet-700 group-hover:opacity-100'
                  }`}
                >
                  <Crosshair className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && onAddPage && (
        <button
          type="button"
          onClick={onAddPage}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2 text-[11px] font-semibold ${
            isWrite
              ? 'border-stone-300 text-stone-600 hover:border-orange-400 hover:bg-orange-50/50'
              : 'border-violet-700/70 text-violet-300 hover:border-violet-500 hover:bg-violet-950/50'
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          {isWrite
            ? t(locale, 'Nova folha', 'Nueva hoja', 'New page')
            : t(locale, 'Novo slide', 'Nuevo slide', 'New slide')}
        </button>
      )}
    </div>
  );
}
