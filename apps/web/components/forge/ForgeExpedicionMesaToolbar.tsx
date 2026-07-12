'use client';

import Link from 'next/link';
import { Play, Users, Dices } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';
import type { GamePhase } from '@/lib/forge/expedicion-v2/types';
import type { BoardPlayer } from '@/lib/forge/expedicion-board-multi';

export function ForgeExpedicionMesaToolbar({
  courseId,
  editionId,
  phase,
  teamCount,
  players,
  turnName,
  busy,
  onStartGame,
  onRollDice,
  canRoll,
}: {
  courseId: string;
  editionId?: string | null;
  phase: GamePhase;
  teamCount: number;
  players: BoardPlayer[];
  turnName?: string | null;
  busy?: boolean;
  onStartGame: () => void;
  onRollDice?: () => void;
  canRoll?: boolean;
}) {
  const ft = useForgeT();
  const turmasHref = editionId
    ? `/hub/forge/cursos/${courseId}/turmas/${editionId}`
    : `/hub/forge/cursos/${courseId}/turmas`;

  const phaseKey = `forge.v2.phase.${phase}`;
  const phaseLabel = ft(phaseKey);
  const showStart = phase === 'lobby' || phase === 'pre_quiz';

  return (
    <div className="shrink-0 border-b border-[#145A45]/15 bg-white/95 px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#145A45]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#145A45]">
          {phaseLabel === phaseKey ? phase : phaseLabel}
        </span>

        {players.length > 0 && (
          <div className="flex items-center gap-1.5">
            {players.map((p) => (
              <span
                key={p.userId}
                title={`${p.name} · casilla ${p.position + 1}`}
                className="inline-flex items-center gap-1 rounded-full border border-[#145A45]/15 bg-[#F5F2EA] px-2 py-0.5 text-[10px] font-semibold text-[#1A3D5C]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: p.color }}
                />
                <span className="max-w-[72px] truncate">{p.name}</span>
              </span>
            ))}
          </div>
        )}

        {turnName && phase === 'playing' && (
          <span className="text-[11px] font-medium text-[#2E5C9A]">
            {ft('forge.room.turnOf', { name: turnName })}
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {teamCount === 0 && (
            <Link
              href={turmasHref}
              className="inline-flex items-center gap-1 rounded-lg border border-[#2E5C9A]/30 bg-[#E8F0FA] px-2.5 py-1.5 text-[10px] font-bold text-[#1A3D5C] hover:bg-[#DCE8F5]"
            >
              <Users className="h-3.5 w-3.5" />
              {ft('forge.v2.mesaCreateTeams')}
            </Link>
          )}

          {showStart && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onStartGame()}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-black text-white shadow-md transition',
                'bg-[#5FAE4A] hover:bg-[#4F9E3A] disabled:opacity-50'
              )}
            >
              <Play className="h-4 w-4" />
              {ft('forge.v2.mesaStartGame')}
            </button>
          )}

          {phase === 'playing' && onRollDice && (
            <button
              type="button"
              disabled={busy || !canRoll}
              onClick={() => void onRollDice()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E5C9A] px-3 py-2 text-xs font-bold text-white hover:bg-[#254D85] disabled:opacity-50"
            >
              <Dices className="h-4 w-4" />
              {ft('forge.room.rollDice')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
