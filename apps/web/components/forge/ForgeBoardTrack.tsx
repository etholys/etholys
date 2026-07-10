'use client';

import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOARD_STATION_META, spaceTooltip, stationForSpace } from '@/lib/forge/board-spaces';
import { boardCellGridPosition, BOARD_TRACK_GRID } from '@/lib/forge/board-track-layout';
import { boardCellTextClass } from '@/lib/forge/expedicion-v2/theme';
import { ForgeInfoTip } from '@/components/forge/ForgeInfoTip';
import type { BoardPlayer } from '@/lib/forge/expedicion-board-multi';

export function ForgeBoardTrack({
  spaces = 20,
  position = 0,
  players = [],
  immersive = false,
  className,
}: {
  spaces?: number;
  position?: number;
  players?: BoardPlayer[];
  immersive?: boolean;
  compact?: boolean;
  className?: string;
}) {
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

  return (
    <div
      className={cn(
        'relative w-full',
        immersive
          ? 'rounded-3xl border-2 border-[#145A45]/25 bg-gradient-to-br from-[#FAFAF7] via-[#F5F2EA] to-[#E8E4D8] p-4 md:p-6 shadow-lg shadow-[#145A45]/10'
          : 'rounded-2xl border-2 border-[#145A45]/20 bg-[#FAFAF7] p-3 shadow-sm',
        className
      )}
    >
      {!immersive && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#145A45]/80 mb-2 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          Tablero colectivo · La Expedición
          <ForgeInfoTip text="Circuito de 20 casillas. En tu turno lanzas el dado y avanzas." />
        </p>
      )}

      <div
        className={cn(
          'relative mx-auto w-full max-w-4xl',
          immersive ? 'aspect-[4/3] min-h-[280px] sm:min-h-[340px] md:min-h-[420px]' : ''
        )}
      >
        <div
          className="absolute inset-[12%] rounded-2xl border-2 border-dashed border-[#145A45]/20 bg-white/80 flex items-center justify-center pointer-events-none shadow-inner"
          aria-hidden
        >
          <div className="text-center px-4">
            <p className="text-lg md:text-2xl font-black text-[#145A45] tracking-wide">LA EXPEDICIÓN</p>
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
            const cellPawns = pawnsByCell.get(i) ?? [];
            const active = players.length === 0 ? i === position : cellPawns.length > 0;
            const isStart = i === 0;
            const isGoal = i === spaces - 1;
            const textClass = boardCellTextClass(st.name);

            return (
              <div
                key={i}
                style={{ gridColumn: col + 1, gridRow: row + 1 }}
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-lg md:rounded-xl font-bold transition-all z-10 shadow-sm',
                  immersive
                    ? 'min-h-[2.5rem] sm:min-h-[3rem] md:min-h-[3.5rem] text-[10px] sm:text-xs md:text-sm'
                    : 'h-9 w-full text-[9px] sm:text-[10px]',
                  st.color,
                  textClass,
                  active && `z-20 scale-105 ring-2 ${st.ring} shadow-md`,
                  !active && 'opacity-95'
                )}
              >
                <span className="absolute top-0.5 right-0.5 z-20 scale-75 opacity-80">
                  <ForgeInfoTip text={spaceTooltip(i, spaces)} />
                </span>
                {isStart && <span className="absolute -top-1 left-0.5 text-[8px]">▶</span>}
                {isGoal && <span className="absolute -top-1 left-0.5 text-[8px]">🏁</span>}
                <span className="font-black">{i}</span>
                <span
                  className={cn(
                    'font-medium opacity-90 truncate max-w-full px-0.5',
                    immersive ? 'text-[8px] sm:text-[9px] md:text-[10px]' : 'hidden sm:block text-[7px]'
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
                        className={cn(
                          'rounded-full border-2 border-white shadow',
                          immersive ? 'h-3 w-3 md:h-3.5 md:w-3.5' : 'h-2.5 w-2.5'
                        )}
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

      <div className="mt-3 flex flex-wrap gap-1 justify-center">
        {BOARD_STATION_META.map((s) => (
          <span
            key={s.name}
            className={cn(
              'rounded-full px-2 py-0.5 font-bold flex items-center gap-0.5 shadow-sm',
              immersive ? 'text-[9px] md:text-[10px]' : 'text-[8px]',
              s.color,
              boardCellTextClass(s.name)
            )}
          >
            {s.name}
            <ForgeInfoTip text={s.desc} />
          </span>
        ))}
      </div>
    </div>
  );
}
