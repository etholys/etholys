'use client';

import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ForgeInfoTip({
  text,
  className,
  label = 'Info',
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  return (
    <span className={cn('group relative inline-flex', className)}>
      <button
        type="button"
        className="rounded-full p-0.5 text-slate-400 hover:text-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
        aria-label={label}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-left text-[11px] font-normal leading-snug text-slate-100 shadow-xl group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}
