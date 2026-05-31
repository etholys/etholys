'use client';

import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATIONS = [
  { name: 'Raíces', color: 'bg-emerald-500', ring: 'ring-emerald-300' },
  { name: 'Acción', color: 'bg-amber-400', ring: 'ring-amber-200' },
  { name: 'Tierra', color: 'bg-amber-700', ring: 'ring-amber-400' },
  { name: 'Desafío', color: 'bg-red-500', ring: 'ring-red-300' },
  { name: 'Alquimia', color: 'bg-orange-500', ring: 'ring-orange-300' },
  { name: 'Mercado', color: 'bg-sky-500', ring: 'ring-sky-300' },
  { name: 'Futuro', color: 'bg-violet-600', ring: 'ring-violet-300' },
];

const PATTERN = [0, 1, 2, 3, 4, 1, 5, 3, 4, 1, 2, 3, 0, 1, 4, 3, 5, 1, 6, 3];

function stationForSpace(i: number) {
  return STATIONS[PATTERN[i % PATTERN.length]] ?? STATIONS[0];
}

/** Pista visual da Expedição (20 casillas em S) — tabuleiro colectivo. */
export function ForgeBoardTrack({
  spaces = 20,
  position = 0,
  compact = false,
  className,
}: {
  spaces?: number;
  position?: number;
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
      </p>
      <div className="relative space-y-1">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-between gap-0.5">
            {row.map((i) => {
              const st = stationForSpace(i);
              const active = i === position;
              const isStart = i === 0;
              const isGoal = i === spaces - 1;
              return (
                <div
                  key={i}
                  title={`Casilla ${i}: ${st.name}`}
                  className={cn(
                    'relative flex flex-col items-center justify-center rounded-lg text-white font-bold transition-all',
                    compact ? 'h-9 w-9 text-[9px]' : 'h-11 w-11 sm:h-12 sm:w-12 text-[10px]',
                    st.color,
                    active && `scale-110 z-10 ring-4 ${st.ring} shadow-lg`,
                    !active && 'opacity-85'
                  )}
                >
                  {isStart && <span className="absolute -top-1 text-[7px]">▶</span>}
                  {isGoal && <span className="absolute -top-1 text-[7px]">🏁</span>}
                  <span>{i}</span>
                  {!compact && (
                    <span className="hidden sm:block text-[7px] font-medium opacity-90 truncate max-w-[2.5rem]">
                      {st.name.slice(0, 4)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="relative mt-2 flex flex-wrap gap-1 justify-center">
        {STATIONS.map((s) => (
          <span
            key={s.name}
            className={cn('rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white', s.color)}
          >
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
