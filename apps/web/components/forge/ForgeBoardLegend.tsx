'use client';

import { SPIRAL_BOARD_LEGEND, type SpiralLegendItem } from '@/lib/forge/board-spiral-data';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';

function LegendSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function LegendRow({ item, label }: { item: SpiralLegendItem; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#1A3D5C] sm:text-[11px]">
        {label}
      </span>
      <LegendSwatch color={item.color} />
    </div>
  );
}

export function ForgeBoardLegend({ className }: { className?: string }) {
  const ft = useForgeT();
  const label = (key: SpiralLegendItem['key']) => ft(`forge.board.legend.${key}`);

  const [raices, tierra, alquimia, futuro, mercado] = SPIRAL_BOARD_LEGEND.top;
  const [desafio, accion] = SPIRAL_BOARD_LEGEND.bottom;

  return (
    <div
      className={cn(
        'rounded-md border border-[#1A3D5C]/10 bg-white/95 px-2.5 py-2 shadow-md backdrop-blur-sm',
        'max-[360px]:hidden',
        className
      )}
      role="group"
      aria-label={ft('forge.board.legend.title')}
    >
      <div className="grid grid-cols-2 gap-x-5 gap-y-1">
        <LegendRow item={raices} label={label('raices')} />
        <LegendRow item={futuro} label={label('futuro')} />
        <LegendRow item={tierra} label={label('tierra')} />
        <LegendRow item={mercado} label={label('mercado')} />
        <LegendRow item={alquimia} label={label('alquimia')} />
      </div>
      <div className="my-1.5 border-t border-[#1A3D5C]/15" />
      <div className="grid grid-cols-2 gap-x-5 gap-y-1">
        <LegendRow item={desafio} label={label('desafio')} />
        <LegendRow item={accion} label={label('accion')} />
      </div>
    </div>
  );
}
