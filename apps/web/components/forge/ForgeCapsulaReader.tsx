'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import type { CapsulaTecnica } from '@/lib/forge/expedicion-v2/capsulas-content';
import { cn } from '@/lib/utils';

export function ForgeCapsulaReader({
  capsula,
  defaultOpen,
  compact,
}: {
  capsula: CapsulaTecnica;
  defaultOpen?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="rounded-xl border border-[#1B5E4B]/20 bg-[#F4FAF7] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#E8F5F0]"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1B5E4B]">
          <BookOpen className="h-3.5 w-3.5" />
          {capsula.title}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
        )}
      </button>
      {open && (
        <div className={cn('px-3 pb-3 space-y-2 text-xs text-slate-800', compact && 'max-h-48 overflow-y-auto')}>
          {capsula.visual && (
            <p className="text-[10px] text-slate-500 italic">Visual: {capsula.visual}</p>
          )}
          {capsula.guion && (
            <p>
              <span className="font-bold text-[#5B3E8C]">Guion: </span>
              {capsula.guion}
            </p>
          )}
          {capsula.tecnico && (
            <p>
              <span className="font-bold text-amber-900">Facilitador: </span>
              {capsula.tecnico}
            </p>
          )}
          <div className="whitespace-pre-wrap leading-relaxed">{capsula.body}</div>
          {capsula.accion && (
            <p className="rounded-lg bg-[#1B5E4B]/10 px-2 py-1.5 font-semibold text-[#1B5E4B]">
              Acción en mapa: {capsula.accion}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
