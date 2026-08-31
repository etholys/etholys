'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Paperclip, X } from 'lucide-react';

type Props = {
  locale: string;
  names: string[];
  /** Pending queue — show remove buttons */
  editable?: boolean;
  onRemove?: (index: number) => void;
};

export function StudioChatAttachmentChips({ locale, names, editable, onRemove }: Props) {
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt';
  const [open, setOpen] = useState(false);

  if (!names.length) return null;

  const compact = names.length > 2 && !editable;
  const summaryLabel =
    loc === 'es'
      ? `${names.length} archivo${names.length === 1 ? '' : 's'}`
      : loc === 'en'
        ? `${names.length} file${names.length === 1 ? '' : 's'}`
        : `${names.length} ficheiro${names.length === 1 ? '' : 's'}`;

  if (editable && names.length > 2 && !open) {
    return (
      <div className="mb-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
        >
          <Paperclip className="h-3 w-3" />
          {summaryLabel}
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if (compact && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white/70 px-2 py-0.5 text-[10px] font-medium text-stone-600 hover:border-orange-200"
      >
        <Paperclip className="h-3 w-3" />
        {summaryLabel}
        <ChevronRight className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${editable ? 'mb-2' : 'mt-1'}`}>
      {editable && names.length > 2 && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-800 hover:underline"
        >
          <ChevronDown className="h-3 w-3" />
          {loc === 'es' ? 'Ocultar' : loc === 'en' ? 'Hide' : 'Ocultar'}
        </button>
      )}
      {names.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-950"
        >
          <Paperclip className="h-3 w-3 shrink-0" />
          <span className="max-w-[9rem] truncate">{name}</span>
          {editable && onRemove && (
            <button type="button" onClick={() => onRemove(i)} aria-label="Remove">
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
