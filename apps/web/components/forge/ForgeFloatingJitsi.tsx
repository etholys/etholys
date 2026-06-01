'use client';

import { useCallback, useRef, useState } from 'react';
import {
  GripVertical,
  Maximize2,
  Minimize2,
  Monitor,
  Users,
  Video,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForgeT } from '@/lib/forge/use-forge-t';

export type JitsiLayoutMode = 'pip' | 'strip' | 'grid';

export function ForgeFloatingJitsi({
  embedSrc,
  fallbackUrl,
}: {
  embedSrc: string | null;
  fallbackUrl: string | null;
}) {
  const ft = useForgeT();
  const [minimized, setMinimized] = useState(false);
  const [layout, setLayout] = useState<JitsiLayoutMode>('pip');
  const [pos, setPos] = useState({ x: 16, y: 72 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({
      x: Math.max(8, drag.current.ox + (e.clientX - drag.current.sx)),
      y: Math.max(56, drag.current.oy + (e.clientY - drag.current.sy)),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  const sizeClass =
    layout === 'pip'
      ? minimized
        ? 'w-14 h-14'
        : 'w-[min(92vw,320px)] h-[200px]'
      : layout === 'strip'
        ? minimized
          ? 'w-14 h-14'
          : 'w-[min(96vw,480px)] h-[140px]'
        : minimized
          ? 'w-14 h-14'
          : 'w-[min(96vw,560px)] h-[320px]';

  if (!embedSrc && !fallbackUrl) return null;

  return (
    <div
      className="fixed z-[54] touch-none"
      style={{ left: pos.x, top: pos.y }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className={cn(
          'overflow-hidden rounded-2xl border-2 border-sky-500/50 bg-black shadow-2xl transition-all',
          sizeClass
        )}
      >
        <div
          className="flex cursor-grab items-center gap-1 bg-sky-950/90 px-2 py-1 active:cursor-grabbing"
          onPointerDown={onPointerDown}
        >
          <GripVertical className="h-3.5 w-3.5 text-sky-400" />
          <Video className="h-3.5 w-3.5 text-sky-300" />
          <span className="flex-1 text-[10px] font-bold text-sky-200 truncate">
            {ft('forge.room.video')}
          </span>
          {!minimized && (
            <>
              <button
                type="button"
                title="PiP"
                onClick={() => setLayout('pip')}
                className={cn('rounded p-1', layout === 'pip' && 'bg-sky-700')}
              >
                <Monitor className="h-3 w-3 text-white" />
              </button>
              <button
                type="button"
                title="Tira"
                onClick={() => setLayout('strip')}
                className={cn('rounded p-1', layout === 'strip' && 'bg-sky-700')}
              >
                <Users className="h-3 w-3 text-white" />
              </button>
              <button
                type="button"
                title="Grelha"
                onClick={() => setLayout('grid')}
                className={cn('rounded p-1', layout === 'grid' && 'bg-sky-700')}
              >
                <LayoutGrid className="h-3 w-3 text-white" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setMinimized((m) => !m)}
            className="rounded p-1 hover:bg-sky-800"
          >
            {minimized ? (
              <Maximize2 className="h-3.5 w-3.5 text-white" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5 text-white" />
            )}
          </button>
        </div>
        {!minimized && (
          <>
            {embedSrc ? (
              <iframe
                title="Jitsi"
                src={embedSrc}
                className="h-[calc(100%-28px)] w-full bg-black"
                allow="camera; microphone; fullscreen; display-capture; autoplay"
              />
            ) : (
              <div className="flex h-[calc(100%-28px)] items-center justify-center p-3">
                <a
                  href={fallbackUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white"
                >
                  {ft('forge.live.join')}
                </a>
              </div>
            )}
            {embedSrc && (
              <p className="px-2 py-1 text-[9px] text-sky-300/80 bg-sky-950">
                {ft('forge.room.jitsiShareHint')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
