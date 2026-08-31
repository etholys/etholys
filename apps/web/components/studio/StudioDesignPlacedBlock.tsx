'use client';

import { useRef } from 'react';
import { Move } from 'lucide-react';
import type { StudioBlockLayout } from '@/lib/studio/types';

type Props = {
  layout?: StudioBlockLayout;
  canEdit?: boolean;
  /** Se true, posiciona absoluto (modo design com layout). */
  freeform?: boolean;
  onLayoutChange?: (layout: StudioBlockLayout) => void;
  children: React.ReactNode;
};

const SNAP = 2;

function snapPct(n: number): number {
  return Math.round(n / SNAP) * SNAP;
}

/**
 * Wrapper Canva-like: no Desenho, blocos com `layout` são arrastáveis e redimensionáveis.
 */
export function StudioDesignPlacedBlock({
  layout,
  canEdit,
  freeform,
  onLayoutChange,
  children,
}: Props) {
  const drag = useRef<{
    mode: 'move' | 'resize' | 'resizeH';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    parentW: number;
    parentH: number;
  } | null>(null);

  const placed = freeform && layout && (layout.xPct != null || layout.yPct != null);

  if (!placed) {
    return <div className="shrink-0">{children}</div>;
  }

  const x = layout.xPct ?? 0;
  const y = layout.yPct ?? 0;
  const w = layout.wPct ?? 88;
  const h = layout.hPct;

  function sheetEl(from: EventTarget | null): HTMLElement | null {
    return ((from as HTMLElement | null)?.closest?.('[data-studio-sheet-body]') ||
      null) as HTMLElement | null;
  }

  function begin(
    e: React.PointerEvent,
    mode: 'move' | 'resize' | 'resizeH',
  ) {
    e.preventDefault();
    e.stopPropagation();
    const parent = sheetEl(e.currentTarget);
    if (!parent || !onLayoutChange) return;
    const rect = parent.getBoundingClientRect();
    drag.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: x,
      origY: y,
      origW: w,
      origH: h ?? 20,
      parentW: rect.width || 1,
      parentH: rect.height || 1,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent) {
    if (!drag.current || !onLayoutChange) return;
    const dx = ((e.clientX - drag.current.startX) / drag.current.parentW) * 100;
    const dy = ((e.clientY - drag.current.startY) / drag.current.parentH) * 100;
    if (drag.current.mode === 'move') {
      const nextW = drag.current.origW;
      const nextX = snapPct(Math.max(0, Math.min(100 - nextW, drag.current.origX + dx)));
      const nextY = snapPct(Math.max(0, Math.min(92, drag.current.origY + dy)));
      onLayoutChange({ ...layout, xPct: nextX, yPct: nextY, wPct: nextW, hPct: h });
    } else if (drag.current.mode === 'resizeH') {
      const nextH = snapPct(Math.max(8, Math.min(92 - drag.current.origY, drag.current.origH + dy)));
      onLayoutChange({ ...layout, xPct: drag.current.origX, yPct: drag.current.origY, wPct: drag.current.origW, hPct: nextH });
    } else {
      const nextW = snapPct(Math.max(18, Math.min(100 - drag.current.origX, drag.current.origW + dx)));
      onLayoutChange({ ...layout, xPct: drag.current.origX, yPct: drag.current.origY, wPct: nextW, hPct: h });
    }
  }

  function end(e: React.PointerEvent) {
    drag.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="group/place absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        zIndex: layout.zIndex ?? 10,
        ...(h != null ? { height: `${h}%`, overflow: 'hidden' } : {}),
      }}
    >
      {canEdit && onLayoutChange ? (
        <>
          <button
            type="button"
            title="Arrastar"
            className="absolute -left-1 -top-1 z-20 flex h-6 w-6 cursor-grab items-center justify-center rounded-md border border-violet-400/70 bg-violet-950 text-violet-50 opacity-0 shadow-md group-hover/place:opacity-100 active:cursor-grabbing"
            onPointerDown={(e) => begin(e, 'move')}
            onPointerMove={move}
            onPointerUp={end}
          >
            <Move className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Redimensionar largura"
            aria-label="Resize width"
            className="absolute -bottom-1 -right-1 z-20 h-3.5 w-3.5 cursor-se-resize rounded-sm border border-violet-300 bg-violet-500 opacity-0 shadow group-hover/place:opacity-100"
            onPointerDown={(e) => begin(e, 'resize')}
            onPointerMove={move}
            onPointerUp={end}
          />
          <button
            type="button"
            title="Redimensionar altura"
            aria-label="Resize height"
            className="absolute -bottom-1 left-1/2 z-20 h-2 w-5 -translate-x-1/2 cursor-s-resize rounded-full border border-violet-300 bg-violet-400 opacity-0 group-hover/place:opacity-100"
            onPointerDown={(e) => begin(e, 'resizeH')}
            onPointerMove={move}
            onPointerUp={end}
          />
        </>
      ) : null}
      <div className="rounded-md bg-white/0 ring-1 ring-transparent transition group-hover/place:ring-violet-400/50 group-focus-within/place:ring-violet-400/70 group-hover/place:shadow-[0_8px_24px_rgba(76,29,149,0.18)]">
        {children}
      </div>
    </div>
  );
}
