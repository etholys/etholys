'use client';

import { useCallback, useRef, useState } from 'react';
import type { ConstructionMapState, PostItType } from '@/lib/forge/expedicion-v2/types';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import { EXPEDICION_V2_STATIONS, POST_IT_TYPE_STYLES } from '@/lib/forge/expedicion-v2/theme';
import { EXPEDICION_STATION_SLUGS } from '@/lib/forge/expedicion-station-decks';
import { Link2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForgeT } from '@/lib/forge/use-forge-t';

const TYPES: PostItType[] = ['diagnostico', 'accion', 'inversion', 'metrica'];

function sortedPostIts(map: ConstructionMapState, station: ExpedicionStationSlug) {
  return map.postIts
    .filter((p) => p.station === station)
    .slice()
    .sort((a, b) => a.y - b.y || a.createdAt.localeCompare(b.createdAt));
}

export function ForgeConstructionCanvas({
  map,
  onAddPostIt,
  onUpdatePostIt,
  onRemovePostIt,
  onAddConnection,
  readOnly,
}: {
  map: ConstructionMapState;
  onAddPostIt: (station: ExpedicionStationSlug, type: PostItType, text: string) => void;
  onUpdatePostIt: (id: string, patch: { text?: string; type?: PostItType; x?: number; y?: number }) => void;
  onRemovePostIt: (id: string) => void;
  onAddConnection: (fromId: string, toId: string) => void;
  readOnly?: boolean;
}) {
  const ft = useForgeT();
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [draftStation, setDraftStation] = useState<ExpedicionStationSlug>('raices');
  const [draftType, setDraftType] = useState<PostItType>('diagnostico');
  const [draftText, setDraftText] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; startY: number; origY: number } | null>(null);

  const handlePostItClick = (id: string) => {
    if (readOnly) return;
    if (connectFrom === 'pick') {
      setConnectFrom(id);
      return;
    }
    if (!connectFrom) {
      return;
    }
    if (connectFrom === id) {
      setConnectFrom(null);
      return;
    }
    onAddConnection(connectFrom, id);
    setConnectFrom(null);
  };

  const submitPostIt = () => {
    if (!draftText.trim()) return;
    onAddPostIt(draftStation, draftType, draftText.trim());
    setDraftText('');
  };

  const onDragMove = useCallback(
    (clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = clientY - drag.startY;
      onUpdatePostIt(drag.id, { y: Math.max(0, drag.origY + delta) });
    },
    [onUpdatePostIt]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDraggingId(null);
  }, []);

  const startDrag = (id: string, clientY: number, origY: number) => {
    if (readOnly || connectFrom) return;
    dragRef.current = { id, startY: clientY, origY };
    setDraggingId(id);
  };

  return (
    <div
      className="space-y-3"
      onPointerMove={(e) => {
        if (dragRef.current) onDragMove(e.clientY);
      }}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#1B5E4B]">{ft('forge.v2.mapConstruction')}</h3>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setConnectFrom(connectFrom ? null : 'pick')}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold',
              connectFrom ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-800'
            )}
          >
            <Link2 className="h-3.5 w-3.5" />
            {connectFrom ? ft('forge.v2.cancelLink') : ft('forge.v2.connectPostIts')}
          </button>
        )}
      </div>

      {!readOnly && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <select
              value={draftStation}
              onChange={(e) => setDraftStation(e.target.value as ExpedicionStationSlug)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            >
              {EXPEDICION_STATION_SLUGS.map((s) => (
                <option key={s} value={s}>
                  {EXPEDICION_V2_STATIONS[s].label}
                </option>
              ))}
            </select>
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as PostItType)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {POST_IT_TYPE_STYLES[t].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={ft('forge.v2.postItPlaceholder')}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={submitPostIt}
              className="inline-flex items-center gap-1 rounded-lg bg-[#1B5E4B] px-3 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4" /> {ft('forge.v2.addPostIt')}
            </button>
          </div>
          {connectFrom && connectFrom !== 'pick' && (
            <p className="text-[10px] text-violet-700">{ft('forge.v2.tapToLink')}</p>
          )}
          {connectFrom === 'pick' && (
            <p className="text-[10px] text-violet-700">{ft('forge.v2.selectFirstPostIt')}</p>
          )}
          {!connectFrom && (
            <p className="text-[10px] text-slate-500">{ft('forge.v2.dragToReorder')}</p>
          )}
        </div>
      )}

      <div className="relative">
        {map.connections.length > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 z-10 hidden lg:block"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          >
            {map.connections.map((c) => {
              const from = map.postIts.find((p) => p.id === c.fromPostItId);
              const to = map.postIts.find((p) => p.id === c.toPostItId);
              if (!from || !to) return null;
              const colFrom = EXPEDICION_STATION_SLUGS.indexOf(from.station);
              const colTo = EXPEDICION_STATION_SLUGS.indexOf(to.station);
              const idxFrom = sortedPostIts(map, from.station).findIndex((p) => p.id === from.id);
              const idxTo = sortedPostIts(map, to.station).findIndex((p) => p.id === to.id);
              const x1 = ((colFrom + 0.5) / 5) * 100;
              const x2 = ((colTo + 0.5) / 5) * 100;
              const y1 = 18 + idxFrom * 14;
              const y2 = 18 + idxTo * 14;
              return (
                <line
                  key={c.id}
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="#5B3E8C"
                  strokeWidth="2"
                  markerEnd="url(#arrow)"
                />
              );
            })}
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#5B3E8C" />
              </marker>
            </defs>
          </svg>
        )}
        <div className="grid gap-3 lg:grid-cols-5 relative z-0">
          {EXPEDICION_STATION_SLUGS.map((station) => {
            const theme = EXPEDICION_V2_STATIONS[station];
            const items = sortedPostIts(map, station);
            return (
              <div
                key={station}
                className={cn('rounded-xl border-2 min-h-[200px] flex flex-col', theme.column)}
              >
                <div className={cn('rounded-t-[10px] px-2 py-2 text-center text-xs font-bold', theme.header)}>
                  {theme.label}
                </div>
                <div className="flex-1 p-2 space-y-2">
                  {items.map((p) => {
                    const st = POST_IT_TYPE_STYLES[p.type];
                    const linked = connectFrom === p.id;
                    const dragging = draggingId === p.id;
                    return (
                      <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => connectFrom && handlePostItClick(p.id)}
                        onPointerDown={(e) => {
                          if ((e.target as HTMLElement).closest('textarea,button')) return;
                          startDrag(p.id, e.clientY, p.y);
                        }}
                        style={{ transform: dragging ? 'scale(1.02)' : undefined }}
                        className={cn(
                          'rounded-lg border-2 p-2 text-left shadow-sm touch-none',
                          st.bg,
                          st.border,
                          st.text,
                          linked && 'ring-2 ring-violet-500',
                          dragging && 'ring-2 ring-[#1B5E4B] shadow-md z-20 relative',
                          connectFrom ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[9px] font-bold uppercase opacity-70">{st.label}</span>
                          {!readOnly && !connectFrom && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemovePostIt(p.id);
                              }}
                              className="rounded p-0.5 hover:bg-black/10"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {readOnly ? (
                          <p className="mt-1 text-[11px] leading-snug">{p.text}</p>
                        ) : (
                          <textarea
                            value={p.text}
                            onChange={(e) => onUpdatePostIt(p.id, { text: e.target.value })}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="mt-1 w-full resize-none bg-transparent text-[11px] leading-snug outline-none min-h-[48px] cursor-text"
                            rows={3}
                          />
                        )}
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="text-[10px] text-slate-400 text-center py-6">Canvas libre</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {map.connections.length > 0 && (
        <p className="text-xs text-slate-600">
          <strong>{map.connections.length}</strong> conexión(es) cruzada(s) entre columnas
        </p>
      )}
    </div>
  );
}
