'use client';

import { ForgeBoardLegend } from '@/components/forge/ForgeBoardLegend';
import { ForgeBoardSpiral } from '@/components/forge/ForgeBoardSpiral';
import type { BoardPlayer } from '@/lib/forge/expedicion-board-multi';
import { cn } from '@/lib/utils';

/** Tablero La Expedición — caracol físico (30 casillas visuales, motor 0…19) */
export function ForgeBoardTrack({
  spaces = 20,
  position = 0,
  players = [],
  fitContainer = false,
  hideLegend = true,
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
  return (
    <div className={cn('relative h-full w-full min-h-0 min-w-0', className)}>
      <ForgeBoardSpiral
        spaces={spaces}
        position={position}
        players={players}
        fitContainer={fitContainer}
        className="h-full w-full"
      />
      {!hideLegend && <ForgeBoardLegend className="absolute bottom-2 left-2 z-10 sm:bottom-3 sm:left-3" />}
    </div>
  );
}
