'use client';

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
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
  };
};

export function StudioWriteRibbon({ disabled, onWrap, onCommand, onKind, onStyle, labels }: Props) {
  const btn =
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 hover:bg-white hover:shadow-sm disabled:opacity-40';

  return (
    <div className="sticky top-0 z-30 mb-4 border-b border-stone-200/80 bg-[#f7f4ef]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[720px] flex-wrap items-center gap-1 px-2 py-2">
        <span className="mr-2 hidden text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400 sm:inline">
          {labels.format}
        </span>
        <div className="flex items-center gap-0.5 rounded-lg border border-stone-200 bg-stone-100/80 p-0.5">
          <button type="button" disabled={disabled} title={labels.bold} className={btn} onClick={() => onWrap('**', '**')}>
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button type="button" disabled={disabled} title={labels.italic} className={btn} onClick={() => onWrap('_', '_')}>
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            title={labels.underline}
            className={btn}
            onClick={() => onWrap('<u>', '</u>')}
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-stone-200 bg-stone-100/80 p-0.5">
          <button type="button" disabled={disabled} title={labels.heading} className={btn} onClick={() => onKind('heading')}>
            <Heading2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" disabled={disabled} title={labels.body} className={btn} onClick={() => onKind('paragraph')}>
            <Type className="h-3.5 w-3.5" />
          </button>
          <button type="button" disabled={disabled} title={labels.list} className={btn} onClick={() => onKind('bullets')}>
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            title={labels.orderedList}
            className={btn}
            onClick={() => onCommand?.('orderedList')}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            title={labels.link}
            className={btn}
            onClick={() => onCommand?.('link')}
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-stone-200 bg-stone-100/80 p-0.5">
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
        <div className="flex items-center gap-0.5 rounded-lg border border-stone-200 bg-stone-100/80 p-0.5">
          {(['sm', 'md', 'lg', 'xl'] as const).map((textScale) => (
            <button
              key={textScale}
              type="button"
              disabled={disabled}
              onClick={() => onStyle({ textScale })}
              className="h-8 min-w-[2rem] rounded-md px-1.5 text-[10px] font-bold text-slate-700 hover:bg-white hover:shadow-sm disabled:opacity-40"
            >
              {textScale.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-stone-200 bg-stone-100/80 p-0.5">
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
              className="h-8 min-w-[1.75rem] rounded-md px-1.5 text-[10px] font-bold text-slate-700 hover:bg-white hover:shadow-sm disabled:opacity-40"
            >
              {short}
            </button>
          ))}
        </div>
        <p className="ml-auto hidden text-[10px] text-stone-400 lg:block">{labels.hint}</p>
      </div>
    </div>
  );
}
