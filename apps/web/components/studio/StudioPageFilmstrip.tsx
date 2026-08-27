'use client';

import { Plus } from 'lucide-react';
import type { StudioPage } from '@/lib/studio/types';

type Props = {
  pages: StudioPage[];
  activePageId: string | null;
  locale: string;
  onSelect: (pageId: string) => void;
  onAddPage?: () => void;
  canEdit?: boolean;
};

function t(locale: string, pt: string, es: string, en: string): string {
  return locale === 'es' ? es : locale === 'en' ? en : pt;
}

/** Filmstrip estilo Gamma / PowerPoint — navegação slide-a-slide. */
export function StudioPageFilmstrip({
  pages,
  activePageId,
  locale,
  onSelect,
  onAddPage,
  canEdit,
}: Props) {
  const sorted = pages.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="border-t border-violet-900/50 bg-[#0a0610] px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
          {t(locale, 'Slides', 'Slides', 'Slides')}
        </p>
        <p className="text-[10px] text-violet-500">
          {sorted.findIndex((p) => p.id === activePageId) + 1 || 1} / {sorted.length}
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

          return (
            <button
              key={page.id}
              type="button"
              onClick={() => onSelect(page.id)}
              className={`group shrink-0 rounded-lg border transition ${
                active
                  ? 'border-fuchsia-400 bg-violet-900/80 ring-2 ring-fuchsia-400/40'
                  : 'border-violet-800/60 bg-violet-950/40 hover:border-violet-500'
              }`}
              style={{ width: '112px' }}
            >
              <div className="flex aspect-video w-full flex-col overflow-hidden rounded-t-lg bg-white p-1.5">
                <p className="line-clamp-3 text-[8px] leading-tight text-slate-700">{label || '—'}</p>
              </div>
              <p className="px-1.5 py-1 text-center text-[10px] font-semibold text-violet-200">
                {idx + 1}
              </p>
            </button>
          );
        })}
        {canEdit && onAddPage && (
          <button
            type="button"
            onClick={onAddPage}
            className="flex h-[72px] w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-violet-700/60 text-violet-400 hover:border-violet-400 hover:bg-violet-950/60"
          >
            <Plus className="h-4 w-4" />
            <span className="mt-0.5 text-[9px] font-semibold">
              {t(locale, 'Slide', 'Slide', 'Slide')}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
