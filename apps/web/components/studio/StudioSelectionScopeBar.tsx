'use client';

import { Crosshair, X } from 'lucide-react';
import type { StudioCanvasState } from '@/lib/studio/types';
import {
  blockLabelWithPage,
  buildScopeSummary,
  pageSelectionState,
  scopeSummaryLabel,
  togglePageBlockSelection,
} from '@/lib/studio/selection-scope';

type Props = {
  locale: string;
  canvas: StudioCanvasState;
  selectedBlockIds: string[];
  activePageId: string | null;
  disabled?: boolean;
  onChange: (blockIds: string[]) => void;
};

function t(locale: string, pt: string, es: string, en: string) {
  return locale === 'es' ? es : locale === 'en' ? en : pt;
}

export function StudioSelectionScopeBar({
  locale,
  canvas,
  selectedBlockIds,
  activePageId,
  disabled,
  onChange,
}: Props) {
  if (!selectedBlockIds.length) return null;

  const summary = buildScopeSummary(canvas, selectedBlockIds);
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt';

  return (
    <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-orange-800">
          <Crosshair className="h-3 w-3" />
          {t(loc, 'Âmbito IA', 'Ámbito IA', 'AI scope')}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-orange-700">
            {scopeSummaryLabel(summary, loc)}
          </span>
          {activePageId && (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange(togglePageBlockSelection(canvas, activePageId, selectedBlockIds))
              }
              className="text-[10px] font-semibold text-orange-800 underline disabled:opacity-40"
            >
              {pageSelectionState(canvas, activePageId, selectedBlockIds) === 'full'
                ? t(loc, 'Desmarcar folha', 'Desmarcar hoja', 'Deselect page')
                : t(loc, 'Folha actual', 'Hoja actual', 'Current page')}
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className="text-[10px] font-semibold text-orange-700 underline disabled:opacity-40"
          >
            {t(loc, 'Limpar', 'Limpiar', 'Clear')}
          </button>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {summary.byPage.map(({ pageId, pageNumber, blockIds }) => (
          <li key={pageId}>
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-orange-900">
                {t(loc, 'Folha', 'Hoja', 'Page')} {pageNumber}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(togglePageBlockSelection(canvas, pageId, selectedBlockIds))}
                className="text-[10px] font-semibold text-orange-700 hover:underline disabled:opacity-40"
              >
                {pageSelectionState(canvas, pageId, selectedBlockIds) === 'full'
                  ? t(loc, 'Desmarcar folha', 'Desmarcar hoja', 'Deselect page')
                  : t(loc, 'Seleccionar folha', 'Seleccionar hoja', 'Select page')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {blockIds.map((bid) => (
                <button
                  key={bid}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(selectedBlockIds.filter((id) => id !== bid))}
                  className="inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-orange-900 ring-1 ring-orange-200"
                  title={bid}
                >
                  <span className="truncate">{blockLabelWithPage(canvas, bid)}</span>
                  <X className="h-3 w-3 shrink-0 opacity-60" />
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
