'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOARD_STATION_META, spaceTooltip, stationForSpace } from '@/lib/forge/board-spaces';
import {
  boardCellGridPosition,
  BOARD_TRACK_ASPECT,
  BOARD_TRACK_GRID,
} from '@/lib/forge/board-track-layout';
import { boardCellTextClass, boardCellVisual } from '@/lib/forge/expedicion-v2/theme';
import { ForgeInfoTip } from '@/components/forge/ForgeInfoTip';
import type { BoardPlayer } from '@/lib/forge/expedicion-board-multi';

type BoardDims = { width: number; height: number };

export function ForgeBoardTrack({
  spaces = 20,
  position = 0,
  players = [],
  immersive = false,
  fitContainer = false,
  hideLegend = false,
  className,
}: {
  spaces?: number;
  position?: number;
  players?: BoardPlayer[];
  immersive?: boolean;
  fitContainer?: boolean;
  hideLegend?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardDims, setBoardDims] = useState<BoardDims>({ width: 720, height: 240 });

  const pawnsByCell = new Map<number, BoardPlayer[]>();
  if (players.length > 0) {
    for (const p of players) {
      const list = pawnsByCell.get(p.position) ?? [];
      list.push(p);
      pawnsByCell.set(p.position, list);
    }
  } else if (position >= 0) {
    pawnsByCell.set(position, []);
  }

  const cellIndices = Array.from({ length: spaces }, (_, i) => i);
  const cellMin = Math.min(boardDims.width / BOARD_TRACK_GRID.cols, boardDims.height / BOARD_TRACK_GRID.rows);

  useLayoutEffect(() => {
    if (!fitContainer) return;
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const pad = 12;
      const cw = container.clientWidth - pad;
      const ch = container.clientHeight - pad;
      if (cw <= 0 || ch <= 0) return;

      let w = cw;
      let h = w / BOARD_TRACK_ASPECT;
      if (h > ch) {
        h = ch;
        w = h * BOARD_TRACK_ASPECT;
      }
      setBoardDims({
        width: Math.floor(Math.min(w, 960)),
        height: Math.floor(Math.min(h, 960 / BOARD_TRACK_ASPECT)),
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, [fitContainer, spaces, players.length, position]);

  const boardInner = (
    <div
      className={cn(
        'relative mx-auto',
        fitContainer ? 'shrink-0' : 'w-full',
        immersive && !fitContainer ? 'aspect-[4/3] min-h-[280px] sm:min-h-[340px] md:min-h-[420px]' : '',
        !immersive && !fitContainer ? 'max-w-4xl' : ''
      )}
      style={
        fitContainer
          ? { width: boardDims.width, height: boardDims.height }
          : undefined
      }
    >
      <div
        className={cn(
          'absolute rounded-2xl border-2 border-dashed border-[#145A45]/20 bg-white/80 flex items-center justify-center pointer-events-none shadow-inner',
          fitContainer ? 'inset-[8%]' : 'inset-[12%]'
        )}
        aria-hidden
      >
        <div className="text-center px-4">
          <p
            className={cn(
              'font-black text-[#145A45] tracking-wide',
              fitContainer && cellMin >= 52 ? 'text-xl md:text-2xl' : 'text-lg'
            )}
          >
            LA EXPEDICIÓN
          </p>
          <p className="text-[10px] md:text-xs text-[#1A3D5C]/70 mt-1 uppercase tracking-widest">
            Sostenible · Triple impacto
          </p>
        </div>
      </div>

      <div
        className="relative w-full h-full grid gap-1 sm:gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${BOARD_TRACK_GRID.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${BOARD_TRACK_GRID.rows}, minmax(0, 1fr))`,
        }}
      >
        {cellIndices.map((i) => {
          const { col, row } = boardCellGridPosition(i, spaces);
          const st = stationForSpace(i);
          const visual = boardCellVisual(st.name);
          const cellPawns = pawnsByCell.get(i) ?? [];
          const active = players.length === 0 ? i === position : cellPawns.length > 0;
          const isStart = i === 0;
          const isGoal = i === spaces - 1;

          return (
            <div
              key={i}
              style={{
                gridColumn: col + 1,
                gridRow: row + 1,
                backgroundColor: visual.bg,
                color: visual.text,
                borderColor: visual.border,
              }}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-lg md:rounded-xl font-bold transition-all z-10 shadow-sm',
                immersive || fitContainer
                  ? cn(
                      'min-h-0',
                      cellMin >= 56 ? 'text-[11px] sm:text-xs' : cellMin >= 44 ? 'text-[10px]' : 'text-[9px]'
                    )
                  : 'h-9 w-full text-[9px] sm:text-[10px]',
                visual.textClass,
                visual.borderClass,
                active && `z-20 scale-[1.04] ring-2 ${st.ring} shadow-md`
              )}
            >
              <span className="absolute top-0.5 right-0.5 z-20 scale-75 opacity-90">
                <ForgeInfoTip text={spaceTooltip(i, spaces)} />
              </span>
              {isStart && <span className="absolute -top-1 left-0.5 text-[8px]">▶</span>}
              {isGoal && <span className="absolute -top-1 left-0.5 text-[8px]">🏁</span>}
              <span className="font-black drop-shadow-sm">{i}</span>
              <span
                className={cn(
                  'font-semibold truncate max-w-full px-0.5 drop-shadow-sm',
                  immersive || fitContainer
                    ? cellMin >= 48
                      ? 'text-[9px] sm:text-[10px]'
                      : 'text-[8px]'
                    : 'hidden sm:block text-[7px]'
                )}
              >
                {st.name}
              </span>
              {cellPawns.length > 0 && (
                <div className="absolute -bottom-1 left-0 right-0 flex justify-center gap-0.5 flex-wrap px-0.5">
                  {cellPawns.slice(0, 5).map((p) => (
                    <span
                      key={p.userId}
                      title={p.name}
                      className="rounded-full border-2 border-white shadow h-2.5 w-2.5 sm:h-3 sm:w-3"
                      style={{ backgroundColor: p.color }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'relative flex flex-col',
        fitContainer ? 'h-full min-h-0 overflow-hidden' : 'w-full',
        immersive && !fitContainer
          ? 'rounded-3xl border-2 border-[#145A45]/25 bg-gradient-to-br from-[#FAFAF7] via-[#F5F2EA] to-[#E8E4D8] p-4 md:p-6 shadow-lg shadow-[#145A45]/10'
          : fitContainer
            ? 'h-full bg-transparent'
            : 'rounded-2xl border-2 border-[#145A45]/20 bg-[#FAFAF7] p-3 shadow-sm',
        className
      )}
    >
      {!immersive && !fitContainer && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#145A45]/80 mb-2 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          Tablero colectivo · La Expedición
          <ForgeInfoTip text="Circuito de 20 casillas. En tu turno lanzas el dado y avanzas." />
        </p>
      )}

      <div
        ref={containerRef}
        className={cn(
          'flex flex-1 min-h-0 items-center justify-center',
          fitContainer ? 'overflow-hidden p-1' : ''
        )}
      >
        {boardInner}
      </div>

      {!hideLegend && !fitContainer && (
        <div className="mt-3 flex flex-wrap gap-1 justify-center shrink-0">
          {BOARD_STATION_META.map((s) => {
            const v = boardCellVisual(s.name);
            return (
              <span
                key={s.name}
                style={{ backgroundColor: v.bg, color: v.text, borderColor: v.border }}
                className={cn(
                  'rounded-full px-2 py-0.5 font-bold flex items-center gap-0.5 shadow-sm border',
                  immersive ? 'text-[9px] md:text-[10px]' : 'text-[8px]',
                  boardCellTextClass(s.name)
                )}
              >
                {s.name}
                <ForgeInfoTip text={s.desc} />
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
