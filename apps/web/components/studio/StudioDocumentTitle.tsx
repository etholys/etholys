'use client';

import { useRef } from 'react';
import { Pencil } from 'lucide-react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  canEdit: boolean;
  variant?: 'write' | 'design';
  placeholder: string;
  editHint: string;
};

/** Título do documento — sempre clicável e com área de toque generosa. */
export function StudioDocumentTitle({
  value,
  onChange,
  onBlur,
  canEdit,
  variant = 'write',
  placeholder,
  editHint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDesign = variant === 'design';

  function focusTitle() {
    if (!canEdit) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  if (!canEdit) {
    return (
      <p
        className={`min-w-0 flex-1 truncate text-base font-semibold sm:text-lg ${
          isDesign ? 'text-violet-50' : 'text-stone-900'
        }`}
      >
        {value || placeholder}
      </p>
    );
  }

  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={focusTitle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          focusTitle();
        }
      }}
      title={editHint}
      className={`group relative flex min-w-[10rem] flex-1 cursor-text items-center gap-2 rounded-lg border px-2 py-1 transition ${
        isDesign
          ? 'border-transparent hover:border-violet-600 hover:bg-violet-950/60 focus-within:border-violet-500 focus-within:bg-violet-950/80 focus-within:ring-2 focus-within:ring-violet-500/40'
          : 'border-transparent hover:border-stone-300 hover:bg-white/70 focus-within:border-orange-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-200/80'
      }`}
    >
      <Pencil
        className={`h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-60 group-focus-within:opacity-80 ${
          isDesign ? 'text-violet-300' : 'text-orange-600'
        }`}
        aria-hidden
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        aria-label={editHint}
        className={`min-w-0 w-full cursor-text border-0 bg-transparent text-base font-semibold outline-none focus:ring-0 sm:text-lg ${
          isDesign
            ? 'text-violet-50 placeholder:text-violet-400'
            : 'text-stone-900 placeholder:text-stone-400'
        }`}
      />
    </div>
  );
}
