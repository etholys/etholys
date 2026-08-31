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
        className={`min-w-0 flex-1 truncate text-sm font-medium ${
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
      className={`group relative flex min-w-0 max-w-[min(100%,28rem)] flex-1 cursor-text items-center gap-1 rounded px-1 py-0.5 transition ${
        isDesign
          ? 'border-transparent hover:border-violet-600 hover:bg-violet-950/60 focus-within:border-violet-500 focus-within:bg-violet-950/80 focus-within:ring-2 focus-within:ring-violet-500/40'
          : 'border-transparent hover:border-stone-300 hover:bg-white/70 focus-within:border-orange-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-200/80'
      }`}
    >
      <Pencil
        className={`h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-50 group-focus-within:opacity-70 ${
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
        className={`min-w-0 w-full cursor-text border-0 bg-transparent text-sm font-medium outline-none focus:ring-0 ${
          isDesign
            ? 'text-violet-50 placeholder:text-violet-400'
            : 'text-stone-900 placeholder:text-stone-400'
        }`}
      />
    </div>
  );
}
