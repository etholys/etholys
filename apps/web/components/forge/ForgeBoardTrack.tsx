'use client';

import { ForgeBoardSpiral } from '@/components/forge/ForgeBoardSpiral';
import type { BoardPlayer } from '@/lib/forge/expedicion-board-multi';

/** Tablero La Expedición — caracol físico (30 casillas visuales, motor 0…19) */
export function ForgeBoardTrack({
  spaces = 20,
  position = 0,
  players = [],
  fitContainer = false,
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
    <ForgeBoardSpiral
      spaces={spaces}
      position={position}
      players={players}
      fitContainer={fitContainer}
      className={className}
    />
  );
}
