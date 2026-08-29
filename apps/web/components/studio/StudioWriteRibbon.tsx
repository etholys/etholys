'use client';

import { useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Type,
  Underline,
} from 'lucide-react';
import type { StudioBlockKind, StudioBlockStyle } from '@/lib/studio/types';

type Props = {
  disabled?: boolean;
  onWrap: (before: string, after: string) => void;
  onCommand?: (cmd: 'orderedList' | 'link') => void;
  onKind: (kind: StudioBlockKind) => void;
  onStyle: (partial: StudioBlockStyle) => void;
  labels: {
    format: string;
    bold: string;
    italic: string;
    underline: string;
    heading: string;
    body: string;
    list: string;
    orderedList: string;
    link: string;
    hint: string;
    more: string;
  };
  /** Barra secundária: nova folha, badges, etc. */
  trailing?: React.ReactNode;
};

export function StudioWriteRibbon({
  disabled,
  onWrap,
  onCommand,
  onKind,
  onStyle,
  labels,
  trailing,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const btn =
    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40';

  return (
    <div className="sticky top-0 z-30 border-b border-stone-200/70 bg-[#f7f4ef]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[720px] items-center gap-1.5 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          <div className="flex shrink-0 items-center rounded-md border border-stone-200/80 bg-white/80 p-0.5 shadow-sm">
            <button type="button" disabled={disabled} title={labels.bold} className={btn} onClick={() => onWrap('**', '**')}>
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={disabled} title={labels.italic} className={btn} onClick={() => onWrap('_', '_')}>
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={disabled} title={labels.underline} className={btn} onClick={() => onWrap('<u>', '</u>')}>
              <Underline className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex shrink-0 items-center rounded-md border border-stone-200/80 bg-white/80 p-0.5 shadow-sm">
            <button type="button" disabled={disabled} title={labels.heading} className={btn} onClick={() => onKind('heading')}>
              <Heading2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={disabled} title={labels.body} className={btn} onClick={() => onKind('paragraph')}>
              <Type className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={disabled} title={labels.list} className={btn} onClick={() => onKind('bullets')}>
              <List className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={disabled} title={labels.orderedList} className={btn} onClick={() => onCommand?.('orderedList')}>
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={disabled} title={labels.link} className={btn} onClick={() => onCommand?.('link')}>
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMoreOpen((v) => !v)}
            className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md border border-stone-200/80 bg-white/80 px-2 text-[10px] font-semibold text-slate-600 shadow-sm hover:bg-white"
          >
            {labels.more}
            <ChevronDown className={`h-3 w-3 transition ${moreOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {trailing ? <div className="hidden shrink-0 items-center gap-1.5 sm:flex">{trailing}</div> : null}
      </div>
      {moreOpen && (
        <div className="mx-auto flex max-w-[720px] flex-wrap items-center gap-2 border-t border-stone-200/50 px-2 py-1.5">
          <div className="flex items-center gap-0.5 rounded-md border border-stone-200/80 bg-white/80 p-0.5">
            <button type="button" disabled={disabled} className={btn} onClick={() => onStyle({ align: 'left' })}>
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={disabled} className={btn} onClick={() => onStyle({ align: 'center' })}>
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={disabled} className={btn} onClick={() => onStyle({ align: 'right' })}>
              <AlignRight className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={disabled} className={btn} onClick={() => onStyle({ align: 'justify' })}>
              <AlignJustify className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-0.5 rounded-md border border-stone-200/80 bg-white/80 p-0.5">
            {(['sm', 'md', 'lg', 'xl'] as const).map((textScale) => (
              <button
                key={textScale}
                type="button"
                disabled={disabled}
                onClick={() => onStyle({ textScale })}
                className="h-7 min-w-[1.75rem] rounded px-1 text-[9px] font-bold text-slate-600 hover:bg-white disabled:opacity-40"
              >
                {textScale.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 rounded-md border border-stone-200/80 bg-white/80 p-0.5">
            {(
              [
                ['none', '—'],
                ['subtle', 'S'],
                ['card', 'C'],
                ['accent', 'A'],
              ] as const
            ).map(([frame, short]) => (
              <button
                key={frame}
                type="button"
                disabled={disabled}
                title={frame}
                onClick={() => onStyle({ frame })}
                className="h-7 min-w-[1.5rem] rounded px-1 text-[9px] font-bold text-slate-600 hover:bg-white disabled:opacity-40"
              >
                {short}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
