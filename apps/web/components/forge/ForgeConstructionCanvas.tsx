'use client';

import { useState } from 'react';
import type { ConstructionMapState, PostItType } from '@/lib/forge/expedicion-v2/types';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import { EXPEDICION_V2_STATIONS, POST_IT_TYPE_STYLES } from '@/lib/forge/expedicion-v2/theme';
import { EXPEDICION_STATION_SLUGS } from '@/lib/forge/expedicion-station-decks';
import { Link2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPES: PostItType[] = ['diagnostico', 'accion', 'inversion', 'metrica'];

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
  onUpdatePostIt: (id: string, patch: { text?: string; type?: PostItType }) => void;
  onRemovePostIt: (id: string) => void;
  onAddConnection: (fromId: string, toId: string) => void;
  readOnly?: boolean;
}) {
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [draftStation, setDraftStation] = useState<ExpedicionStationSlug>('raices');
  const [draftType, setDraftType] = useState<PostItType>('diagnostico');
  const [draftText, setDraftText] = useState('');

  const handlePostItClick = (id: string) => {
    if (readOnly) return;
    if (!connectFrom) {
      setConnectFrom(id);
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#1B5E4B]">Mapa — Zona de Construcción</h3>
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
            {connectFrom ? 'Cancelar enlace' : 'Conectar post-its'}
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
              placeholder="Texto del post-it…"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={submitPostIt}
              className="inline-flex items-center gap-1 rounded-lg bg-[#1B5E4B] px-3 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4" /> Añadir
            </button>
          </div>
          {connectFrom && connectFrom !== 'pick' && (
            <p className="text-[10px] text-violet-700">Toca otro post-it para enlazar</p>
          )}
          {connectFrom === 'pick' && (
            <p className="text-[10px] text-violet-700">Selecciona el primer post-it</p>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-5">
        {EXPEDICION_STATION_SLUGS.map((station) => {
          const theme = EXPEDICION_V2_STATIONS[station];
          const items = map.postIts.filter((p) => p.station === station);
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
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => connectFrom && handlePostItClick(p.id)}
                      className={cn(
                        'rounded-lg border-2 p-2 text-left shadow-sm cursor-pointer',
                        st.bg,
                        st.border,
                        st.text,
                        linked && 'ring-2 ring-violet-500'
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
                          className="mt-1 w-full resize-none bg-transparent text-[11px] leading-snug outline-none min-h-[48px]"
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

      {map.connections.length > 0 && (
        <p className="text-xs text-slate-600">
          <strong>{map.connections.length}</strong> conexión(es) cruzada(s) entre columnas
        </p>
      )}
    </div>
  );
}
