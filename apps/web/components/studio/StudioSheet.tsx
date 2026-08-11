'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  width: number;
  height: number;
  pageLabel: string;
  backgroundImage?: string | null;
  canEdit?: boolean;
  /** Chamado com ids de blocos (do fim) a mover para a folha seguinte */
  onOverflowBlocks?: (blockIds: string[]) => void;
  overflowHint?: string;
  children: React.ReactNode;
};

/**
 * Folha de documento com dimensões fixas (ex. A4).
 * Conteúdo que passa da altura útil é sinalizado para a página seguinte.
 */
export function StudioSheet({
  width,
  height,
  pageLabel,
  backgroundImage,
  canEdit,
  onOverflowBlocks,
  overflowHint,
  children,
}: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const lastMovedAt = useRef(0);
  const busy = useRef(false);
  const onOverflowRef = useRef(onOverflowBlocks);
  onOverflowRef.current = onOverflowBlocks;

  const checkOverflow = useCallback(() => {
    const body = bodyRef.current;
    if (!body || busy.current) return;

    const fits = body.scrollHeight <= body.clientHeight + 2;
    setOverflowing(!fits);
    if (fits || !canEdit || !onOverflowRef.current) return;

    const now = Date.now();
    if (now - lastMovedAt.current < 900) return;

    const nodes = Array.from(body.querySelectorAll<HTMLElement>('[data-studio-block-id]'));
    if (nodes.length <= 1) return;

    const bodyRect = body.getBoundingClientRect();
    const bodyBottom = bodyRect.bottom;
    const toMove: string[] = [];
    for (let i = nodes.length - 1; i >= 1; i--) {
      const el = nodes[i]!;
      const rect = el.getBoundingClientRect();
      // Bloco que ultrapassa o fundo útil da folha
      if (rect.bottom > bodyBottom - 2 || rect.top >= bodyBottom - 8) {
        const id = el.dataset.studioBlockId;
        if (id) toMove.unshift(id);
      } else {
        break;
      }
    }

    if (!toMove.length) return;
    busy.current = true;
    lastMovedAt.current = now;
    onOverflowRef.current(toMove);
    window.setTimeout(() => {
      busy.current = false;
    }, 120);
  }, [canEdit]);

  useEffect(() => {
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

    const t = window.setTimeout(checkOverflow, 60);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.clearTimeout(t);
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
      {/* Área útil tipográfica — altura fixa, sem crescimento infinito */}
      <div
        ref={bodyRef}
        className={`absolute inset-0 z-10 box-border overflow-hidden px-[9%] pb-12 pt-[7.5%] ${
          backgroundImage ? 'bg-white/88' : ''
        }`}
        style={{
          fontFamily: 'var(--font-etholys-sans), ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div className="flex min-h-0 flex-col gap-3.5">{children}</div>
      </div>

      {/* Guias de margem (régua visual) */}
      <div className="pointer-events-none absolute inset-[5.5%] z-[1] rounded-[1px] border border-dashed border-slate-200/80" />
      <div className="pointer-events-none absolute left-[5.5%] right-[5.5%] top-[5.5%] z-[1] h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />

      {/* Rodapé de página — fora da medição de overflow dos blocos */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
        <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-medium tracking-[0.14em] text-slate-400">
          {pageLabel}
        </span>
      </div>

      {overflowing && (
        <div className="absolute bottom-8 left-1/2 z-30 max-w-[92%] -translate-x-1/2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-center text-[10px] font-semibold text-amber-900 shadow-sm">
          {overflowHint || 'Folha cheia — o excesso passa para a folha seguinte'}
        </div>
      )}
    </div>
  );
}
