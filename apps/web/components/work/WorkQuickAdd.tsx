'use client';

import { useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WorkQuickAdd({
  placeholder,
  addLabel = 'Add',
  disabled,
  onSubmit,
  className,
}: {
  placeholder: string;
  addLabel?: string;
  disabled?: boolean;
  onSubmit: (title: string) => Promise<void>;
  className?: string;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const title = value.trim();
    if (!title || busy || disabled) return;
    setBusy(true);
    try {
      await onSubmit(title);
      setValue('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-100',
        className,
      )}
    >
      <Plus className="h-4 w-4 shrink-0 text-cyan-600" />
      <input
        ref={inputRef}
        value={value}
        disabled={disabled || busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-50"
      />
      <button
        type="button"
        disabled={disabled || busy || !value.trim()}
        onClick={() => void submit()}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {addLabel}
      </button>
    </div>
  );
}
