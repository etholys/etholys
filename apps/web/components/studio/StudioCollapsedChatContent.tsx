'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const COLLAPSE_LINES = 6;

type Props = {
  content: string;
  locale: string;
};

export function StudioCollapsedChatContent({ content, locale }: Props) {
  const lines = content.split('\n');
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt';
  const [open, setOpen] = useState(false);

  if (lines.length <= COLLAPSE_LINES) {
    return (
      <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{content}</div>
    );
  }

  const preview = lines.slice(0, 2).join(' · ');
  const label =
    loc === 'es'
      ? `${lines.length} líneas`
      : loc === 'en'
        ? `${lines.length} lines`
        : `${lines.length} linhas`;

  return (
    <div className="min-w-0 max-w-full">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full min-w-0 items-start gap-1 overflow-hidden rounded-lg border border-stone-200/80 bg-white/60 px-2 py-1.5 text-left text-xs text-stone-600 hover:border-orange-200 hover:bg-orange-50/50"
        >
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400 group-hover:text-orange-600" />
          <span className="min-w-0 flex-1 overflow-hidden text-left">
            <span className="block font-semibold text-stone-800">{label}</span>
            <span className="mt-0.5 block line-clamp-2 break-words text-stone-500 [overflow-wrap:anywhere]">
              {preview}
            </span>
          </span>
        </button>
      ) : (
        <div className="min-w-0 max-w-full">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 hover:underline"
          >
            <ChevronDown className="h-3 w-3" />
            {loc === 'es' ? 'Ocultar' : loc === 'en' ? 'Collapse' : 'Ocultar'}
          </button>
          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{content}</div>
        </div>
      )}
    </div>
  );
}
