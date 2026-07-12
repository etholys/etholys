'use client';

import { useMemo } from 'react';
import {
  Calendar,
  FlaskConical,
  Hand,
  Leaf,
  Megaphone,
  Sprout,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { spaceTooltip } from '@/lib/forge/board-spaces';
import {
  positionToSpiralTile,
  spiralTileByNumber,
  spiralTileTextColor,
  type SpiralTileIcon,
} from '@/lib/forge/board-spiral-data';
import { buildSpiralSegments, spiralViewBoxString } from '@/lib/forge/board-spiral-geometry';
import type { BoardPlayer } from '@/lib/forge/expedicion-board-multi';

const SEGMENTS = buildSpiralSegments();
const VIEW_BOX = spiralViewBoxString();

function TileIcon({ icon, className }: { icon: SpiralTileIcon; className?: string }) {
  const props = { className: cn('h-6 w-6', className), strokeWidth: 2.2 };
  switch (icon) {
    case 'leaf':
      return <Leaf {...props} />;
    case 'zap':
      return <Zap {...props} />;
    case 'sprout':
      return <Sprout {...props} />;
    case 'hand':
      return <Hand {...props} />;
    case 'flask':
      return <FlaskConical {...props} />;
    case 'megaphone':
      return <Megaphone {...props} />;
    case 'calendar':
      return <Calendar {...props} />;
  }
}

export function ForgeBoardSpiral({
  spaces = 20,
  position = 0,
  players = [],
  fitContainer = false,
  className,
}: {
  spaces?: number;
  position?: number;
  players?: BoardPlayer[];
  fitContainer?: boolean;
  className?: string;
}) {
  const pawnsByTile = useMemo(() => {
    const map = new Map<number, BoardPlayer[]>();
    if (players.length > 0) {
      for (const p of players) {
        const tile = positionToSpiralTile(p.position, spaces);
        const list = map.get(tile) ?? [];
        list.push(p);
        map.set(tile, list);
      }
    } else if (position >= 0) {
      map.set(positionToSpiralTile(position, spaces), []);
    }
    return map;
  }, [players, position, spaces]);

  const activeTile = positionToSpiralTile(
    players.length > 0 ? players[0]?.position ?? position : position,
    spaces
  );

  const svg = (
    <svg
      viewBox={VIEW_BOX}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Tablero La Expedición Sostenible"
    >
      <defs>
        <filter id="spiral-shadow" x="-4%" y="-4%" width="108%" height="108%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.12" />
        </filter>
      </defs>
      <g filter="url(#spiral-shadow)">
        {SEGMENTS.map((seg) => {
          const tile = spiralTileByNumber(seg.n);
          const hasLabel = Boolean(tile.label);
          const textColor = hasLabel ? '#FFFFFF' : spiralTileTextColor(tile.bg);
          const gameIndex = seg.n <= 20 ? seg.n - 1 : -1;
          const tip =
            gameIndex >= 0
              ? spaceTooltip(gameIndex, spaces)
              : `Casilla ${String(seg.n).padStart(2, '0')} · ${tile.label ?? ''}`;

          const hasPawns = (pawnsByTile.get(seg.n)?.length ?? 0) > 0;
          const isActive = hasPawns || activeTile === seg.n;

          return (
            <g key={seg.n}>
              <path
                d={seg.path}
                fill={tile.bg}
                stroke="#FFFFFF"
                strokeWidth={3.5}
                strokeLinejoin="round"
                className={cn(isActive && 'brightness-110')}
              />
              {!hasLabel && (
                <foreignObject
                  x={seg.iconX - 16}
                  y={seg.iconY - 16}
                  width={32}
                  height={32}
                  className="pointer-events-none"
                >
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ color: textColor }}
                  >
                    <TileIcon icon={tile.icon} />
                  </div>
                </foreignObject>
              )}
              {hasLabel && (
                <>
                  <foreignObject
                    x={seg.iconX - 14}
                    y={seg.iconY - 22}
                    width={28}
                    height={28}
                    className="pointer-events-none"
                  >
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ color: textColor }}
                    >
                      <TileIcon icon={tile.icon} className="h-5 w-5" />
                    </div>
                  </foreignObject>
                  <text
                    x={seg.labelX}
                    y={seg.labelY + 5}
                    textAnchor="middle"
                    fontSize={seg.isCenter ? 11 : 10}
                    fontWeight={900}
                    fill={textColor}
                    style={{ letterSpacing: '0.08em' }}
                  >
                    {tile.label}
                  </text>
                </>
              )}
              <circle
                cx={seg.badgeX}
                cy={seg.badgeY}
                r={10.5}
                fill="#FFFFFF"
                stroke={tile.bg}
                strokeWidth={1.5}
              />
              <text
                x={seg.badgeX}
                y={seg.badgeY + 3.5}
                textAnchor="middle"
                fontSize={8.5}
                fontWeight={800}
                fill="#1A3D5C"
              >
                {String(seg.n).padStart(2, '0')}
              </text>
              {gameIndex >= 0 && (
                <path d={seg.path} fill="transparent" stroke="none" className="cursor-help">
                  <title>{tip}</title>
                </path>
              )}
            </g>
          );
        })}
      </g>

      {Array.from(pawnsByTile.entries()).map(([tileN, pawns]) => {
        const seg = SEGMENTS[tileN - 1];
        if (!seg || pawns.length === 0) return null;
        return (
          <g key={`pawns-${tileN}`}>
            {pawns.map((p, idx) => {
              const ox = (idx % 3) * 10 - 10;
              const oy = Math.floor(idx / 3) * 10 - 5;
              return (
                <circle
                  key={p.userId}
                  cx={seg.iconX + ox}
                  cy={seg.iconY + oy + 22}
                  r={7}
                  fill={p.color}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  <title>{p.name}</title>
                </circle>
              );
            })}
          </g>
        );
      })}
    </svg>
  );

  if (fitContainer) {
    return (
      <div className={cn('flex h-full w-full min-h-0 min-w-0 items-stretch justify-stretch', className)}>
        {svg}
      </div>
    );
  }

  return <div className={cn('w-full max-w-4xl mx-auto', className)}>{svg}</div>;
}
