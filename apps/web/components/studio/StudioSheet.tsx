'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { StudioOverflowInfo } from '@/lib/studio/paginate';

type Props = {
  width: number;
  height: number;
  pageLabel: string;
  backgroundImage?: string | null;
  canEdit?: boolean;
  /** flow = redação (cresce); fixed = folha A4 rígida (modo desenho) */
  layout?: 'flow' | 'fixed';
  onOverflow?: (info: StudioOverflowInfo) => void;
  marginPx?: { top: number; right: number; bottom: number; left: number };
  /** Barra superior com cor da marca (modo desenho). */
  brandAccent?: string | null;
  children: React.ReactNode;
};

/**
 * Folha de documento.
 * - flow: altura mínima do formato, cresce com o texto (última folha em redação).
 * - fixed: altura fixa; em desenho move blocos inteiros se onOverflow estiver ativo.
 */
export function StudioSheet({
  width,
  height,
  pageLabel,
  backgroundImage,
  canEdit,
  layout = 'flow',
  onOverflow,
  marginPx,
  brandAccent,
  children,
}: Props) {
  const pad = marginPx || { top: 48, right: 56, bottom: 48, left: 56 };
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const lastMovedAt = useRef(0);
  const busy = useRef(false);
  const attempts = useRef(0);
  const onOverflowRef = useRef(onOverflow);
  onOverflowRef.current = onOverflow;
  const isFixed = layout === 'fixed';

  const checkOverflow = useCallback(() => {
    if (!isFixed) return;
    const body = bodyRef.current;
    if (!body || busy.current) return;
    if (!canEdit || !onOverflowRef.current) return;

    const active = document.activeElement;
    if (active && body.contains(active) && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
      return;
    }

    const fits = body.scrollHeight <= body.clientHeight + 2;
    if (fits) {
      attempts.current = 0;
      return;
    }

    const now = Date.now();
    const wait = Math.min(8000, Math.round(500 * Math.pow(1.8, attempts.current)));
    if (now - lastMovedAt.current < wait) return;

    const nodes = Array.from(body.querySelectorAll<HTMLElement>('[data-studio-block-id]'));
    if (nodes.length <= 1) return;

    const bodyBottom = body.getBoundingClientRect().bottom;
    const toMove: string[] = [];
    for (let i = nodes.length - 1; i >= 1; i--) {
      const el = nodes[i]!;
      const rect = el.getBoundingClientRect();
      // Só blocos que já estão completamente abaixo / quase fora — sem partir
      if (rect.top >= bodyBottom - 12 || rect.bottom > bodyBottom + 4) {
        const id = el.dataset.studioBlockId;
        if (id) toMove.unshift(id);
      } else {
        break;
      }
    }
    if (!toMove.length) {
      attempts.current += 1;
      lastMovedAt.current = now;
      return;
    }

    busy.current = true;
    lastMovedAt.current = now;
    attempts.current += 1;
    onOverflowRef.current({
      moveBlockIds: toMove,
      overflowPx: Math.max(0, body.scrollHeight - body.clientHeight),
    });
    window.setTimeout(() => {
      busy.current = false;
    }, 200);
  }, [canEdit, isFixed]);

  useEffect(() => {
    if (!isFixed) return;
    attempts.current = 0;
    const body = bodyRef.current;
    if (!body) return;

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(checkOverflow);
    });
    ro.observe(body);
    for (const child of Array.from(body.querySelectorAll('[data-studio-block-id]'))) {
      if (child instanceof HTMLElement) ro.observe(child);
    }
    const t = window.setTimeout(checkOverflow, 120);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [checkOverflow, children, isFixed]);

  return (
    <div
      className="relative bg-white shadow-[0_12px_40px_rgba(15,23,42,0.14)] ring-1 ring-slate-300/80"
      style={{
        width,
        ...(isFixed ? { height, flexShrink: 0 } : { minHeight: height, height: 'auto' }),
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'top center',
        boxShadow: brandAccent
          ? `0 12px 40px rgba(15,23,42,0.16), inset 0 3px 0 0 ${brandAccent}`
          : undefined,
      }}
    >
      <div
        ref={bodyRef}
        className={`relative z-10 box-border ${isFixed ? 'absolute inset-0 overflow-hidden' : 'overflow-visible'}`}
        style={{
          fontFamily: 'var(--font-etholys-sans), ui-sans-serif, system-ui, sans-serif',
          paddingTop: pad.top,
          paddingRight: pad.right,
          paddingBottom: Math.max(pad.bottom, 36),
          paddingLeft: pad.left,
          ...(isFixed ? {} : { minHeight: height }),
        }}
      >
        <div className="flex min-h-0 flex-col gap-3.5">{children}</div>
      </div>

      <div
        className="pointer-events-none absolute z-[1] rounded-[1px] border border-dashed border-slate-200/70"
        style={{
          top: pad.top,
          right: pad.right,
          bottom: isFixed ? pad.bottom : Math.max(pad.bottom, 24),
          left: pad.left,
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
        <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-medium tracking-[0.14em] text-slate-400">
          {pageLabel}
        </span>
      </div>
    </div>
  );
}
