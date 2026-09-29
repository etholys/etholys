'use client';

import { useState } from 'react';
import { Loader2, Plus, Sprout, Trash2 } from 'lucide-react';
import type { RadarCrop } from '@/lib/radar/site-layout';

type Loc = 'pt' | 'es' | 'en';

export function RadarCropsPanel({
  locale,
  crops,
  busy,
  onAdd,
  onRemove,
}: {
  locale: string;
  crops: RadarCrop[];
  busy?: boolean;
  onAdd: (input: { name: string; variety?: string; season?: string }) => Promise<void>;
  onRemove: (cropId: string) => Promise<void>;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [variety, setVariety] = useState('');
  const [season, setSeason] = useState('');
  const [localBusy, setLocalBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) return;
    setLocalBusy(true);
    try {
      await onAdd({
        name: name.trim(),
        variety: variety.trim() || undefined,
        season: season.trim() || undefined,
      });
      setName('');
      setVariety('');
      setSeason('');
      setOpen(false);
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            {loc === 'en' ? 'Crops' : 'Cultivos'}
          </p>
          <h3 className="mt-1 font-serif text-xl text-white">
            {loc === 'es' ? 'Cultivos de la finca' : loc === 'en' ? 'Farm crops' : 'Cultivos da fazenda'}
          </h3>
          <p className="mt-1 text-sm text-white/50">
            {loc === 'es'
              ? 'Nombre, variedad y temporada — después asignalos a parcelas.'
              : loc === 'en'
                ? 'Name, variety and season — then assign them to parcels.'
                : 'Nome, variedade e época — depois liga-os às parcelas.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-[#04110c]"
        >
          <Plus className="h-3.5 w-3.5" />
          {loc === 'en' ? 'New crop' : 'Novo cultivo'}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={loc === 'en' ? 'Crop name' : 'Nome do cultivo'}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
            autoFocus
          />
          <input
            value={variety}
            onChange={(e) => setVariety(e.target.value)}
            placeholder={loc === 'en' ? 'Variety (optional)' : 'Variedade (opcional)'}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
          <input
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder={loc === 'en' ? 'Season (optional)' : 'Época / safra (opcional)'}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
          <div className="flex gap-2 sm:col-span-3">
            <button
              type="button"
              disabled={localBusy || busy || name.trim().length < 2}
              onClick={() => void submit()}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-40"
            >
              {localBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : loc === 'en' ? 'Add' : 'Adicionar'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm text-white/55">
              {loc === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}

      {crops.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/12 px-4 py-6 text-center">
          <Sprout className="mx-auto h-5 w-5 text-white/30" />
          <p className="mt-2 text-sm text-white/50">
            {loc === 'es'
              ? 'Todavía no hay cultivos. Agregá el primero.'
              : loc === 'en'
                ? 'No crops yet. Add the first one.'
                : 'Ainda sem cultivos. Adiciona o primeiro.'}
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {crops.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{c.name}</p>
                <p className="mt-0.5 truncate text-xs text-white/45">
                  {[c.variety, c.season].filter(Boolean).join(' · ') || (loc === 'en' ? 'No variety/season' : 'Sem variedade/época')}
                </p>
              </div>
              <button
                type="button"
                disabled={busy || localBusy}
                onClick={() => void onRemove(c.id)}
                className="rounded-lg p-1.5 text-white/35 hover:bg-white/5 hover:text-rose-200"
                title={loc === 'en' ? 'Remove' : 'Remover'}
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
