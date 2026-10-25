'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Sprout, Trash2, X } from 'lucide-react';
import type { RadarCrop } from '@/lib/radar/site-layout';
import { radarLoc, radarT } from '@/lib/radar/i18n';

export function RadarCropsPanel({
  locale,
  crops,
  busy,
  onAdd,
  onUpdate,
  onRemove,
}: {
  locale: string;
  crops: RadarCrop[];
  busy?: boolean;
  onAdd: (input: { name: string; variety?: string; season?: string }) => Promise<void>;
  onUpdate: (cropId: string, input: { name: string; variety?: string; season?: string }) => Promise<void>;
  onRemove: (cropId: string) => Promise<void>;
}) {
  const loc = radarLoc(locale);
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<RadarCrop | null>(null);
  const [name, setName] = useState('');
  const [variety, setVariety] = useState('');
  const [season, setSeason] = useState('');
  const [localBusy, setLocalBusy] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setVariety(editing.variety || '');
    setSeason(editing.season || '');
  }, [editing]);

  const resetForm = () => {
    setName('');
    setVariety('');
    setSeason('');
  };

  const submitAdd = async () => {
    if (name.trim().length < 2) return;
    setLocalBusy(true);
    try {
      await onAdd({
        name: name.trim(),
        variety: variety.trim() || undefined,
        season: season.trim() || undefined,
      });
      resetForm();
      setOpenAdd(false);
    } catch {
      /* parent surfaces error */
    } finally {
      setLocalBusy(false);
    }
  };

  const submitEdit = async () => {
    if (!editing || name.trim().length < 2) return;
    setLocalBusy(true);
    try {
      await onUpdate(editing.id, {
        name: name.trim(),
        variety: variety.trim() || undefined,
        season: season.trim() || undefined,
      });
      setEditing(null);
      resetForm();
    } catch {
      /* parent surfaces error */
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            {loc === 'en' ? 'Crops' : 'Cultivos'}
          </p>
          <h3 className="mt-1 font-serif text-xl text-white">
            {radarT(loc, 'Cultivos da fazenda', 'Cultivos de la finca', 'Farm crops')}
          </h3>
          <p className="mt-1 text-sm text-white/55">
            {radarT(
              loc,
              'Nome, variedade e época — depois liga-os às parcelas.',
              'Nombre, variedad y temporada — después asignalos a parcelas.',
              'Name, variety and season — then assign them to parcels.',
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            resetForm();
            setOpenAdd(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-[#04110c]"
        >
          <Plus className="h-3.5 w-3.5" />
          {radarT(loc, 'Novo cultivo', 'Nuevo cultivo', 'New crop')}
        </button>
      </div>

      {openAdd && (
        <div className="rounded-xl border border-white/15 bg-[#0c1a24] px-4 py-4">
          <p className="text-sm font-semibold text-white">{radarT(loc, 'Novo cultivo', 'Nuevo cultivo', 'New crop')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={radarT(loc, 'Nome do cultivo', 'Nombre del cultivo', 'Crop name')}
              className="rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400/40"
              autoFocus
            />
            <input
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              placeholder={radarT(loc, 'Variedade (opcional)', 'Variedad (opcional)', 'Variety (optional)')}
              className="rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
            <input
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder={radarT(loc, 'Época / safra (opcional)', 'Temporada (opcional)', 'Season (optional)')}
              className="rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={localBusy || busy || name.trim().length < 2}
              onClick={() => void submitAdd()}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-40"
            >
              {localBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : radarT(loc, 'Adicionar', 'Agregar', 'Add')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenAdd(false);
                resetForm();
              }}
              className="rounded-xl px-3 py-2 text-sm text-white/55"
            >
              {radarT(loc, 'Cancelar', 'Cancelar', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="rounded-xl border border-teal-400/35 bg-[#0c1a24] px-4 py-4 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-200/80">
                {radarT(loc, 'Ficha do cultivo', 'Ficha del cultivo', 'Crop file')}
              </p>
              <h4 className="mt-1 text-lg font-medium text-white">
                {radarT(loc, 'Cultivo:', 'Cultivo:', 'Crop:')} {editing.name}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                resetForm();
              }}
              className="rounded-full bg-[#12343c] p-2 text-white hover:bg-[#1a4a54]"
              aria-label={radarT(loc, 'Fechar', 'Cerrar', 'Close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-white/45">{radarT(loc, 'Nome', 'Nombre', 'Name')}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400/40"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-white/45">
                {radarT(loc, 'Variedade', 'Variedad', 'Variety')}
              </span>
              <input
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-white/45">
                {radarT(loc, 'Época / safra', 'Temporada', 'Season')}
              </span>
              <input
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={localBusy || busy || name.trim().length < 2}
              onClick={() => void submitEdit()}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-40"
            >
              {localBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : radarT(loc, 'Guardar', 'Guardar', 'Save')}
            </button>
            <button
              type="button"
              disabled={localBusy || busy}
              onClick={() => {
                const ok = window.confirm(
                  radarT(
                    loc,
                    `Apagar o cultivo «${editing.name}»?`,
                    `¿Borrar el cultivo «${editing.name}»?`,
                    `Delete crop “${editing.name}”?`,
                  ),
                );
                if (!ok) return;
                void onRemove(editing.id).then(() => {
                  setEditing(null);
                  resetForm();
                });
              }}
              className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-40"
            >
              {radarT(loc, 'Apagar', 'Borrar', 'Delete')}
            </button>
          </div>
        </div>
      )}

      {crops.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#0c1a24] px-4 py-6 text-center">
          <Sprout className="mx-auto h-5 w-5 text-white/35" />
          <p className="mt-2 text-sm text-white/55">
            {radarT(
              loc,
              'Ainda sem cultivos. Adiciona o primeiro.',
              'Todavía no hay cultivos. Agregá el primero.',
              'No crops yet. Add the first one.',
            )}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {crops.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-xl border border-white/12 bg-[#0c1a24] px-3 py-3"
            >
              <button
                type="button"
                onClick={() => {
                  setOpenAdd(false);
                  setEditing(c);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate font-medium text-white">{c.name}</p>
                <p className="mt-0.5 truncate text-xs text-white/50">
                  {[c.variety, c.season].filter(Boolean).join(' · ') ||
                    radarT(loc, 'Sem variedade/época', 'Sin variedad/temporada', 'No variety/season')}
                </p>
              </button>
              <button
                type="button"
                disabled={busy || localBusy}
                onClick={() => {
                  setOpenAdd(false);
                  setEditing(c);
                }}
                className="rounded-full bg-[#12343c] p-1.5 text-white hover:bg-[#1a4a54] disabled:opacity-40"
                title={radarT(loc, 'Editar', 'Editar', 'Edit')}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={busy || localBusy}
                onClick={() => {
                  const ok = window.confirm(
                    radarT(
                      loc,
                      `Apagar o cultivo «${c.name}»?`,
                      `¿Borrar el cultivo «${c.name}»?`,
                      `Delete crop “${c.name}”?`,
                    ),
                  );
                  if (!ok) return;
                  void onRemove(c.id);
                }}
                className="rounded-full bg-rose-700 p-1.5 text-white hover:bg-rose-800 disabled:opacity-40"
                title={radarT(loc, 'Apagar', 'Borrar', 'Delete')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
