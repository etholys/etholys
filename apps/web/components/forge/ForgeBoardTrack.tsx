'use client';

import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOARD_STATION_META, spaceTooltip, stationForSpace } from '@/lib/forge/board-spaces';
import { ForgeInfoTip } from '@/components/forge/ForgeInfoTip';
import type { BoardPlayer } from '@/lib/forge/expedicion-board-multi';

/** Pista visual da Expedición (20 casillas em S) — tabuleiro colectivo com peões. */
export function ForgeBoardTrack({
  spaces = 20,
  position = 0,
  players = [],
  compact = false,
  className,
}: {
  spaces?: number;
  position?: number;
  players?: BoardPlayer[];
  compact?: boolean;
  className?: string;
}) {
  const cols = 10;
  const rows: number[][] = [];
  for (let r = 0; r < Math.ceil(spaces / cols); r++) {
    const start = r * cols;
    const slice = Array.from({ length: cols }, (_, c) => start + c).filter((i) => i < spaces);
    rows.push(r % 2 === 1 ? [...slice].reverse() : slice);
  }

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

  return (
    <div
      className={cn(
        'relative rounded-2xl border-2 border-emerald-800/30 bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-900 p-3 shadow-inner',
        className
      )}
    >
      <div className="absolute inset-2 rounded-xl border border-dashed border-emerald-500/20 pointer-events-none" />
      <p className="relative text-[10px] font-bold uppercase tracking-widest text-emerald-300/90 mb-2 flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        Tablero colectivo · La Expedición
        <ForgeInfoTip text="Cada jugador tiene un peón en la pista. En tu turno lanzas el dado y avanzas." />
      </p>
      <div className="relative space-y-1">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-between gap-0.5">
            {row.map((i) => {
              const st = stationForSpace(i);
              const cellPawns = pawnsByCell.get(i) ?? [];
              const active = players.length === 0 ? i === position : cellPawns.length > 0;
              const isStart = i === 0;
              const isGoal = i === spaces - 1;
              return (
                <div
                  key={i}
                  className={cn(
                    'relative flex flex-col items-center justify-center rounded-lg text-white font-bold transition-all',
                    compact ? 'h-9 w-9 text-[9px]' : 'h-11 w-11 sm:h-12 sm:w-12 text-[10px]',
                    st.color,
                    active && `scale-105 z-10 ring-2 ${st.ring} shadow-lg`,
                    !active && 'opacity-85'
                  )}
                >
                  <span className="absolute top-0 right-0 z-20">
                    <ForgeInfoTip text={spaceTooltip(i, spaces)} />
                  </span>
                  {isStart && <span className="absolute -top-1 text-[7px]">▶</span>}
                  {isGoal && <span className="absolute -top-1 text-[7px]">🏁</span>}
                  <span>{i}</span>
                  {!compact && (
                    <span className="hidden sm:block text-[7px] font-medium opacity-90 truncate max-w-[2.5rem]">
                      {st.name.slice(0, 4)}
                    </span>
                  )}
                  {cellPawns.length > 0 && (
                    <div className="absolute -bottom-1 left-0 right-0 flex justify-center gap-px flex-wrap px-0.5">
                      {cellPawns.slice(0, 4).map((p) => (
                        <span
                          key={p.userId}
                          title={p.name}
                          className="h-2.5 w-2.5 rounded-full border border-white shadow"
                          style={{ backgroundColor: p.color }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="relative mt-2 flex flex-wrap gap-1 justify-center">
        {BOARD_STATION_META.map((s) => (
          <span
            key={s.name}
            className={cn('rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white flex items-center gap-0.5', s.color)}
          >
            {s.name}
            <ForgeInfoTip text={s.desc} />
          </span>
        ))}
      </div>
    </div>
  );
}
