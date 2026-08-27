'use client';

import { useMemo } from 'react';
import { StudioMarkdown } from '@/lib/studio/markdown-lite';
import {
  studioBlockAlignClass,
  studioBlockFrameClass,
  studioBlockScaleClass,
} from '@/lib/studio/block-style';
import type { StudioCanvasState } from '@/lib/studio/types';
import { STUDIO_PAGE_SIZE_MM } from '@/lib/studio/types';

type Props = {
  canvas: StudioCanvasState;
  /** Índice da página a mostrar (0-based) */
  pageIndex?: number;
  className?: string;
  brandColor?: string;
};

const BASE_W = 420;

/** Miniatura fiel do layout Design (posições % + estilos). */
export function StudioTemplatePreview({
  canvas,
  pageIndex = 0,
  className = '',
  brandColor = '#7c3aed',
}: Props) {
  const page = canvas.pages[pageIndex] ?? canvas.pages[0];
  const pageSize = page?.pageSize || canvas.pageSize || 'A4';
  const mm = STUDIO_PAGE_SIZE_MM[pageSize] || STUDIO_PAGE_SIZE_MM.A4;
  const aspect = mm.h / mm.w;
  const width = BASE_W;
  const height = Math.round(width * aspect);
  const isSlide = pageSize === 'Slide';

  const freeform = page?.blocks.some(
    (b) => b.layout && (b.layout.xPct != null || b.layout.yPct != null),
  );

  const pad = useMemo(
    () => ({
      top: Math.round(height * 0.08),
      right: Math.round(width * 0.07),
      bottom: Math.round(height * 0.08),
      left: Math.round(width * 0.07),
    }),
    [height, width],
  );

  if (!page) {
    return (
      <div className={`flex items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500 ${className}`}>
        —
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200 ${className}`}
      style={{
        width,
        height,
        boxShadow: `0 16px 40px rgba(15,23,42,0.12), inset 0 3px 0 0 ${brandColor}`,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          paddingTop: pad.top,
          paddingRight: pad.right,
          paddingBottom: pad.bottom,
          paddingLeft: pad.left,
        }}
      >
        <div className={`relative h-full w-full ${freeform ? '' : 'flex flex-col gap-2'}`}>
          {page.blocks
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((block) => {
              const scaleCls = studioBlockScaleClass(block.style, block.kind);
              const alignCls = studioBlockAlignClass(block.style);
              const frameCls = studioBlockFrameClass(block.style);
              const placed =
                freeform && block.layout && (block.layout.xPct != null || block.layout.yPct != null);
              const inner = (
                <div className={`${scaleCls} ${alignCls} ${frameCls} pointer-events-none`}>
                  {block.kind === 'diagram' ? (
                    <div className="rounded border border-dashed border-violet-300 bg-violet-50 px-2 py-3 text-center text-[10px] text-violet-700">
                      Diagrama
                    </div>
                  ) : block.kind === 'image' ? (
                    <div className="flex aspect-[4/3] items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-100 to-slate-200">
                      {block.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={block.imageUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                      ) : (
                        <span className="text-[10px] font-medium text-slate-500">Imagen</span>
                      )}
                    </div>
                  ) : (
                    <StudioMarkdown
                      text={block.text}
                      variant={block.kind === 'heading' ? 'heading' : block.kind === 'bullets' ? 'bullets' : 'body'}
                      emptyHint="…"
                    />
                  )}
                </div>
              );
              if (!placed) {
                return (
                  <div key={block.id} className="shrink-0">
                    {inner}
                  </div>
                );
              }
              return (
                <div
                  key={block.id}
                  className="absolute"
                  style={{
                    left: `${block.layout!.xPct ?? 0}%`,
                    top: `${block.layout!.yPct ?? 0}%`,
                    width: `${block.layout!.wPct ?? 88}%`,
                  }}
                >
                  {inner}
                </div>
              );
            })}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-medium tracking-wider text-slate-400">
          {isSlide ? 'Slide' : pageSize} · {canvas.studioMode === 'design' ? 'Design' : 'Write'}
        </span>
      </div>
    </div>
  );
}
