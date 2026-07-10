'use client';

import { useState } from 'react';
import { Monitor, Radio, LayoutGrid, X } from 'lucide-react';
import { ForgePresentationViewer } from '@/components/forge/ForgePresentationViewer';
import type { ExpedicionSlide } from '@/lib/forge/expedicion-presentacion-slides';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';

type LiveRow = {
  id: string;
  name: string;
  phase: string;
  balance: number;
  cyclesCompleted: number;
  maxCycles: number;
  impactPoints?: number;
  hasPendingMicroCaso?: boolean;
};

type Mode = 'slides' | 'live' | 'mixed';

export function ForgePresentationView({
  courseTitle,
  slides,
  pdfUrl,
  embedUrl,
  slideIndex,
  onSlideIndexChange,
  liveRows,
  onClose,
}: {
  courseTitle: string;
  slides: ExpedicionSlide[];
  pdfUrl?: string | null;
  embedUrl?: string | null;
  slideIndex: number;
  onSlideIndexChange?: (i: number) => void;
  liveRows: LiveRow[];
  onClose: () => void;
}) {
  const ft = useForgeT();
  const [mode, setMode] = useState<Mode>('mixed');

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0D4535] text-white">
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#145A45] px-3 py-2.5">
        <Monitor className="h-4 w-4 text-[#C9A227]" />
        <span className="text-xs font-bold uppercase tracking-wider text-[#C9A227]">
          {ft('forge.v2.presentationMode')}
        </span>
        <span className="truncate text-sm font-semibold text-white/95">{courseTitle}</span>
        <div className="ml-auto flex gap-1">
          {(['slides', 'live', 'mixed'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[10px] font-bold transition',
                mode === m ? 'bg-[#C9A227] text-[#0D4535]' : 'bg-white/10 hover:bg-white/20 text-white'
              )}
            >
              {m === 'slides' && ft('forge.v2.presentationSlides')}
              {m === 'live' && ft('forge.v2.presentationLive')}
              {m === 'mixed' && ft('forge.v2.presentationMixed')}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20 ml-1"
            aria-label={ft('forge.general.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row bg-[#F5F2EA]">
        {(mode === 'slides' || mode === 'mixed') && slides.length > 0 && (
          <div
            className={cn(
              'flex flex-col min-h-0',
              mode === 'mixed' ? 'flex-1 md:flex-[2]' : 'flex-1'
            )}
          >
            {onSlideIndexChange && (
              <div className="flex shrink-0 gap-1 border-b border-[#145A45]/15 bg-white px-2 py-2">
                <button
                  type="button"
                  disabled={slideIndex <= 0}
                  onClick={() => onSlideIndexChange(Math.max(0, slideIndex - 1))}
                  className="rounded-lg border border-[#145A45]/20 bg-[#F5F2EA] px-3 py-1 text-xs font-bold text-[#145A45] disabled:opacity-40"
                >
                  ←
                </button>
                <span className="flex items-center px-2 text-xs font-semibold text-[#145A45]">
                  {slideIndex + 1} / {slides.length}
                </span>
                <button
                  type="button"
                  disabled={slideIndex >= slides.length - 1}
                  onClick={() => onSlideIndexChange(Math.min(slides.length - 1, slideIndex + 1))}
                  className="rounded-lg border border-[#145A45]/20 bg-[#F5F2EA] px-3 py-1 text-xs font-bold text-[#145A45] disabled:opacity-40"
                >
                  →
                </button>
              </div>
            )}
            <div className="flex-1 overflow-auto p-3 md:p-4">
              <ForgePresentationViewer
                slides={slides}
                pdfUrl={pdfUrl}
                embedUrl={embedUrl}
                slideIndex={slideIndex}
                onSlideIndexChange={onSlideIndexChange}
                audienceMode
              />
            </div>
          </div>
        )}

        {(mode === 'live' || mode === 'mixed') && (
          <aside
            className={cn(
              'flex flex-col min-h-0 border-[#145A45]/15 bg-white',
              mode === 'mixed' ? 'md:w-80 md:border-l max-md:max-h-[40vh] border-t' : 'flex-1'
            )}
          >
            <div className="flex items-center gap-2 border-b border-[#145A45]/10 bg-[#145A45] px-3 py-2.5 text-white">
              {mode === 'live' ? <Radio className="h-4 w-4 text-[#C9A227]" /> : <LayoutGrid className="h-4 w-4 text-[#C9A227]" />}
              <span className="text-xs font-bold">{ft('forge.v2.presentationLiveTitle')}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {liveRows.length === 0 && (
                <p className="text-xs text-[#145A45]/60 px-2 py-4">{ft('forge.v2.noData')}</p>
              )}
              {liveRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-[#145A45]/12 bg-[#F5F2EA] px-3 py-2.5 text-xs">
                  <p className="font-bold text-[#145A45]">{row.name}</p>
                  <p className="text-[#1A3D5C]/90 mt-0.5">
                    {row.phase} · {ft('forge.v2.cycle', { current: row.cyclesCompleted + 1, max: row.maxCycles })}
                    {' · '}
                    {ft('forge.v2.eco', { n: row.balance })}
                    {(row.impactPoints ?? 0) > 0 && ` · ${ft('forge.v2.impact', { n: row.impactPoints ?? 0 })}`}
                  </p>
                  {row.hasPendingMicroCaso && (
                    <p className="text-[#C9A227] mt-1 font-semibold">{ft('forge.v2.pendingMicroCaso')}</p>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
