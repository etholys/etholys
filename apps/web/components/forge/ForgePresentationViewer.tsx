'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Presentation } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';
import type { ExpedicionSlide } from '@/lib/forge/expedicion-presentacion-slides';

type Props = {
  slides: ExpedicionSlide[];
  pdfUrl?: string | null;
  embedUrl?: string | null;
  compact?: boolean;
  slideIndex?: number;
  onSlideIndexChange?: (index: number) => void;
  /** Oculta guion del facilitador (solo alumnos ven diapositiva pública). */
  audienceMode?: boolean;
};

export function ForgePresentationViewer({
  slides,
  pdfUrl,
  embedUrl,
  compact,
  slideIndex: controlledIdx,
  onSlideIndexChange,
  audienceMode = false,
}: Props) {
  const ft = useForgeT();
  const [internalIdx, setInternalIdx] = useState(0);
  const idx = controlledIdx ?? internalIdx;
  const setIdx = onSlideIndexChange ?? setInternalIdx;
  const [mode, setMode] = useState<'slides' | 'pdf' | 'embed'>(
    slides.length > 0 ? 'slides' : pdfUrl ? 'pdf' : embedUrl ? 'embed' : 'slides'
  );

  const slide = slides[idx];

  return (
    <div className={`flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden ${compact ? 'h-full min-h-[320px]' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 bg-slate-50">
        <Presentation className="h-4 w-4 text-violet-600" />
        <span className="text-xs font-bold text-slate-700">{ft('forge.presentation.title')}</span>
        <div className="ml-auto flex gap-1">
          {slides.length > 0 && (
            <button
              type="button"
              onClick={() => setMode('slides')}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold ${mode === 'slides' ? 'bg-violet-600 text-white' : 'bg-white border'}`}
            >
              {ft('forge.presentation.modeSlides')}
            </button>
          )}
          {pdfUrl && (
            <button
              type="button"
              onClick={() => setMode('pdf')}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold ${mode === 'pdf' ? 'bg-violet-600 text-white' : 'bg-white border'}`}
            >
              PDF
            </button>
          )}
          {embedUrl && (
            <button
              type="button"
              onClick={() => setMode('embed')}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold ${mode === 'embed' ? 'bg-violet-600 text-white' : 'bg-white border'}`}
            >
              Embed
            </button>
          )}
        </div>
      </div>

      {mode === 'pdf' && pdfUrl && (
        <iframe title="PPT PDF" src={pdfUrl} className="flex-1 min-h-[280px] w-full" />
      )}
      {mode === 'embed' && embedUrl && (
        <iframe title="PPT embed" src={embedUrl} className="flex-1 min-h-[280px] w-full" allowFullScreen />
      )}
      {mode === 'slides' && slide && (
        <div className="flex-1 p-4 overflow-y-auto min-h-[280px]">
          <p className="text-[10px] font-bold uppercase text-violet-600">
            {ft('forge.presentation.slideN', { n: slide.n, total: slides.length })}
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-900">{slide.title}</h3>
          {slide.visual && (
            <p className="mt-2 text-xs text-slate-500">
              <span className="font-semibold">{ft('forge.presentation.visual')}:</span> {slide.visual}
            </p>
          )}
          {slide.texto && <p className="mt-3 text-sm font-semibold text-slate-800">{slide.texto}</p>}
          {!audienceMode && slide.guion && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm text-amber-950">
              <p className="text-[10px] font-bold uppercase text-amber-800">{ft('forge.presentation.guion')}</p>
              <p className="mt-1">{slide.guion}</p>
            </div>
          )}
          {!audienceMode && slide.tecnico && (
            <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p className="text-[10px] font-bold uppercase">{ft('forge.presentation.tecnico')}</p>
              <p className="mt-1 whitespace-pre-wrap">{slide.tecnico}</p>
            </div>
          )}
          {slide.accion && (
            <p className="mt-2 text-sm text-emerald-800 font-medium">
              <span className="font-bold">{ft('forge.presentation.accion')}:</span> {slide.accion}
            </p>
          )}
        </div>
      )}

      {mode === 'slides' && slides.length > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
          <button
            type="button"
            disabled={idx <= 0}
            onClick={() => setIdx(idx - 1)}
            className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-slate-500">
            {idx + 1} / {slides.length}
          </span>
          <button
            type="button"
            disabled={idx >= slides.length - 1}
            onClick={() => setIdx(idx + 1)}
            className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
