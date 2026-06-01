'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import type { ExpedicionSlide } from '@/lib/forge/expedicion-presentacion-slides';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';

export function ForgeFacilitatorScriptPanel({
  slide,
  slideIndex,
  total,
  onPrev,
  onNext,
}: {
  slide: ExpedicionSlide | undefined;
  slideIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const ft = useForgeT();
  const [open, setOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  if (!slide) return null;

  return (
    <div
      className={cn(
        'fixed z-[53] w-[min(92vw,360px)] rounded-2xl border-2 border-amber-500/40 bg-amber-950/95 text-amber-50 shadow-2xl',
        collapsed ? 'bottom-4 right-4' : 'top-16 right-4 max-h-[50vh]'
      )}
    >
      <div className="flex items-center gap-2 border-b border-amber-500/30 px-3 py-2">
        <GripVertical className="h-4 w-4 text-amber-400/60" />
        <BookOpen className="h-4 w-4 text-amber-300" />
        <span className="flex-1 text-xs font-bold">{ft('forge.presentation.guion')}</span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded p-1 text-[10px] font-bold hover:bg-amber-900"
        >
          {collapsed ? ft('forge.room.scriptOpen') : ft('forge.room.scriptMin')}
        </button>
        {!collapsed && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="rounded p-1 hover:bg-amber-900">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        )}
      </div>
      {!collapsed && open && (
        <div className="overflow-y-auto max-h-[40vh] p-3 text-sm space-y-2">
          <p className="text-[10px] font-bold uppercase text-amber-300/90">
            {ft('forge.presentation.slideN', { n: slide.n, total })}
          </p>
          <p className="font-bold">{slide.title}</p>
          {slide.guion && <p className="leading-relaxed">{slide.guion}</p>}
          {slide.tecnico && (
            <div className="rounded-lg bg-violet-900/50 border border-violet-500/30 p-2 text-xs">
              <p className="font-bold text-violet-200">{ft('forge.room.knowledgeCard')}</p>
              <p className="mt-1 whitespace-pre-wrap">{slide.tecnico}</p>
            </div>
          )}
          {slide.accion && (
            <p className="text-xs text-emerald-200">
              <span className="font-bold">{ft('forge.presentation.accion')}:</span> {slide.accion}
            </p>
          )}
          <div className="flex justify-between pt-2">
            <button
              type="button"
              disabled={slideIndex <= 0}
              onClick={onPrev}
              className="rounded-lg bg-amber-800 px-2 py-1 text-xs font-bold disabled:opacity-40"
            >
              ←
            </button>
            <span className="text-xs self-center">
              {slideIndex + 1}/{total}
            </span>
            <button
              type="button"
              disabled={slideIndex >= total - 1}
              onClick={onNext}
              className="rounded-lg bg-amber-800 px-2 py-1 text-xs font-bold disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
