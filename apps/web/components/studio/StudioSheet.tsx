'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { StudioOverflowInfo } from '@/lib/studio/paginate';

type Props = {
  width: number;
  height: number;
  pageLabel: string;
  backgroundImage?: string | null;
  canEdit?: boolean;
  onOverflow?: (info: StudioOverflowInfo) => void;
  /** Padding da área útil (px), derivado das margens em mm */
  marginPx?: { top: number; right: number; bottom: number; left: number };
  children: React.ReactNode;
};

/**
 * Folha com dimensões fixas. Overflow → reflow automático (partir/mover blocos).
 */
export function StudioSheet({
  width,
  height,
  pageLabel,
  backgroundImage,
  canEdit,
  onOverflow,
  marginPx,
  children,
}: Props) {
  const pad = marginPx || { top: 48, right: 56, bottom: 48, left: 56 };
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const lastMovedAt = useRef(0);
  const busy = useRef(false);
  const attempts = useRef(0);
  const onOverflowRef = useRef(onOverflow);
  onOverflowRef.current = onOverflow;

  const checkOverflow = useCallback(() => {
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
    const wait = Math.min(8000, Math.round(380 * Math.pow(1.7, attempts.current)));
    if (now - lastMovedAt.current < wait) return;

    const nodes = Array.from(body.querySelectorAll<HTMLElement>('[data-studio-block-id]'));
    if (!nodes.length) return;

    const bodyBottom = body.getBoundingClientRect().bottom;
    const overflowing: HTMLElement[] = [];
    for (let i = nodes.length - 1; i >= 0; i--) {
      const el = nodes[i]!;
      const rect = el.getBoundingClientRect();
      if (rect.bottom > bodyBottom - 2 || rect.top >= bodyBottom - 8) {
        overflowing.unshift(el);
      } else {
        break;
      }
    }
    if (!overflowing.length) return;

    const partial: HTMLElement[] = [];
    const fullyBelow: HTMLElement[] = [];
    for (const el of overflowing) {
      const rect = el.getBoundingClientRect();
      if (rect.top < bodyBottom - 8 && rect.bottom > bodyBottom - 2) partial.push(el);
      else fullyBelow.push(el);
    }

    const splitEl = partial[0];
    const moveEls = [...partial.slice(1), ...fullyBelow];
    const splitBlockId = splitEl?.dataset.studioBlockId;
    const moveBlockIds = moveEls
      .map((el) => el.dataset.studioBlockId)
      .filter((id): id is string => !!id);

    if (!splitBlockId && !moveBlockIds.length) return;

    const overflowPx = Math.max(0, body.scrollHeight - body.clientHeight);
    busy.current = true;
    lastMovedAt.current = now;
    attempts.current += 1;
    onOverflowRef.current({
      moveBlockIds,
      splitBlockId,
      overflowPx,
    });
    window.setTimeout(() => {
      busy.current = false;
    }, 180);
  }, [canEdit]);

  useEffect(() => {
    attempts.current = 0;
    const body = bodyRef.current;
    if (!body) return;

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(checkOverflow);
    });
    ro.observe(body);

    const observeBlocks = () => {
      for (const child of Array.from(body.querySelectorAll('[data-studio-block-id]'))) {
        if (child instanceof HTMLElement) ro.observe(child);
      }
    };
    observeBlocks();

    const mo = new MutationObserver(() => {
      observeBlocks();
      requestAnimationFrame(checkOverflow);
    });
    mo.observe(body, { childList: true, subtree: true, characterData: true });

    const t = window.setTimeout(checkOverflow, 80);
    const t2 = window.setTimeout(checkOverflow, 500);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [checkOverflow, children]);

  return (
    <div
      className="relative bg-white shadow-[0_12px_40px_rgba(15,23,42,0.14)] ring-1 ring-slate-300/80"
      style={{
        width,
        height,
        flexShrink: 0,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'top center',
      }}
    >
      <div
        ref={bodyRef}
        className={`absolute inset-0 z-10 box-border overflow-hidden ${
          backgroundImage ? 'bg-white/88' : ''
        }`}
        style={{
          fontFamily: 'var(--font-etholys-sans), ui-sans-serif, system-ui, sans-serif',
          paddingTop: pad.top,
          paddingRight: pad.right,
          paddingBottom: pad.bottom,
          paddingLeft: pad.left,
        }}
      >
        <div className="flex min-h-0 flex-col gap-3.5">{children}</div>
      </div>

      <div
        className="pointer-events-none absolute z-[1] rounded-[1px] border border-dashed border-slate-200/80"
        style={{
          top: pad.top,
          right: pad.right,
          bottom: pad.bottom,
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
