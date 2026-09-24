'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

export type SectorOption = {
  id: string;
  label: string;
};

type Props = {
  options: SectorOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Se true, onChange só atualiza o draft; o utilizador confirma com Apply */
  deferApply?: boolean;
  onApply?: (ids: string[]) => void;
  applying?: boolean;
  applyLabel?: string;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
};

/**
 * Lista suspensa compacta com checkboxes (multi-select).
 * Evita o “tag cloud” que ocupa meia página.
 */
export function NexusSectorMultiSelect({
  options,
  value,
  onChange,
  disabled,
  deferApply,
  onApply,
  applying,
  applyLabel,
  placeholder = 'Temáticas…',
  emptyLabel = 'Ninguna',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectedLabels = options.filter((o) => value.includes(o.id)).map((o) => o.label);
  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(' · ')
        : `${selectedLabels.slice(0, 2).join(' · ')} +${selectedLabels.length - 2}`;

  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    onChange(next);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-sm text-slate-900 outline-none hover:border-slate-300 focus:border-slate-400 disabled:opacity-40"
      >
        <span className={`min-w-0 truncate ${selectedLabels.length === 0 ? 'text-slate-400' : ''}`}>
          {summary}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value.length > 0 && (
            <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-900">
              {value.length}
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[16rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {placeholder}
            </p>
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="inline-flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-slate-800"
              >
                <X className="h-3 w-3" />
                {emptyLabel}
              </button>
            )}
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {options.map((o) => {
              const on = value.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => toggle(o.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      on ? 'bg-teal-50/80 text-teal-950' : 'text-slate-800'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        on ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">{o.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {deferApply && onApply && (
            <div className="border-t border-slate-100 p-2">
              <button
                type="button"
                disabled={applying || value.length === 0}
                onClick={() => {
                  onApply(value);
                  setOpen(false);
                }}
                className="w-full rounded-lg bg-teal-800 px-3 py-2 text-xs font-medium text-white hover:bg-teal-900 disabled:opacity-40"
              >
                {applying ? '…' : applyLabel || 'Aplicar'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
