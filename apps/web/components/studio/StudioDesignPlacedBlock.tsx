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

/**
 * Wrapper Canva-like: no Desenho, blocos com `layout` são arrastáveis na folha.
 */
export function StudioDesignPlacedBlock({
  layout,
  canEdit,
  freeform,
  onLayoutChange,
  children,
}: Props) {
  const drag = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
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

  return (
    <div
      className="group/place absolute z-10"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
      }}
    >
      {canEdit && onLayoutChange ? (
        <button
          type="button"
          title="Arrastar"
          className="absolute -left-1 -top-1 z-20 flex h-6 w-6 cursor-grab items-center justify-center rounded-md border border-violet-400/60 bg-violet-950 text-violet-100 opacity-0 shadow group-hover/place:opacity-100 active:cursor-grabbing"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const parent = (e.currentTarget.closest('[data-studio-sheet-body]') ||
              null) as HTMLElement | null;
            if (!parent) return;
            const rect = parent.getBoundingClientRect();
            drag.current = {
              startX: e.clientX,
              startY: e.clientY,
              origX: x,
              origY: y,
              parentW: rect.width || 1,
              parentH: rect.height || 1,
            };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const dx = ((e.clientX - drag.current.startX) / drag.current.parentW) * 100;
            const dy = ((e.clientY - drag.current.startY) / drag.current.parentH) * 100;
            const nextX = Math.max(0, Math.min(100 - w, drag.current.origX + dx));
            const nextY = Math.max(0, Math.min(92, drag.current.origY + dy));
            onLayoutChange({ ...layout, xPct: nextX, yPct: nextY, wPct: w });
          }}
          onPointerUp={(e) => {
            drag.current = null;
            try {
              (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }}
        >
          <Move className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <div className="rounded-md ring-1 ring-transparent transition group-hover/place:ring-violet-400/40">
        {children}
      </div>
    </div>
  );
}
