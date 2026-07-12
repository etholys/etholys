'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { buildSpiralSegments, SPIRAL_VIEWBOX } from '@/lib/forge/board-spiral-geometry';
import type { BoardPlayer } from '@/lib/forge/expedicion-board-multi';

const SEGMENTS = buildSpiralSegments();

function TileIcon({ icon, className }: { icon: SpiralTileIcon; className?: string }) {
  const props = { className: cn('h-5 w-5', className), strokeWidth: 2.2 };
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(520);

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

  useLayoutEffect(() => {
    if (!fitContainer) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const pad = 8;
      const s = Math.floor(Math.min(el.clientWidth - pad, el.clientHeight - pad, 820));
      if (s > 0) setSize(s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitContainer]);

  const svg = (
    <svg
      viewBox={`0 0 ${SPIRAL_VIEWBOX.width} ${SPIRAL_VIEWBOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label="Tablero La Expedición Sostenible"
    >
      <rect width={SPIRAL_VIEWBOX.width} height={SPIRAL_VIEWBOX.height} fill="#FFFFFF" />

      {SEGMENTS.map((seg) => {
        const tile = spiralTileByNumber(seg.n);
        const textColor = spiralTileTextColor(tile.bg);
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
              strokeWidth={3}
              className={cn(isActive && 'brightness-110')}
            />
            {/* Icono */}
            <foreignObject
              x={seg.iconX - 14}
              y={seg.iconY - 14}
              width={28}
              height={28}
              className="pointer-events-none"
            >
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ color: textColor }}
              >
                <TileIcon icon={tile.icon} className="h-6 w-6 drop-shadow-sm" />
              </div>
            </foreignObject>
            {/* Número */}
            <circle
              cx={seg.badgeX}
              cy={seg.badgeY}
              r={11}
              fill="#FFFFFF"
              stroke={tile.bg}
              strokeWidth={1.5}
            />
            <text
              x={seg.badgeX}
              y={seg.badgeY + 4}
              textAnchor="middle"
              fontSize={9}
              fontWeight={800}
              fill="#1A3D5C"
            >
              {String(seg.n).padStart(2, '0')}
            </text>
            {/* SALIDA / META */}
            {tile.label && (
              <text
                x={seg.labelX}
                y={seg.labelY}
                textAnchor="middle"
                fontSize={seg.n === 1 ? 13 : 11}
                fontWeight={900}
                fill={textColor}
                style={{ letterSpacing: '0.06em' }}
              >
                {tile.label}
              </text>
            )}
            {/* Tooltip hit area */}
            {gameIndex >= 0 && (
              <path d={seg.path} fill="transparent" stroke="none" className="cursor-help">
                <title>{tip}</title>
              </path>
            )}
          </g>
        );
      })}

      {/* Peones */}
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
      <div ref={containerRef} className={cn('flex h-full min-h-0 items-center justify-center', className)}>
        <div style={{ width: size, height: size }} className="max-h-full max-w-full">
          {svg}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-md p-2', className)}>
      {svg}
    </div>
  );
}
