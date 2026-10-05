'use client';

import { useState } from 'react';
import { Loader2, MapPinned, Plus } from 'lucide-react';
import type { RadarCrop } from '@/lib/radar/site-layout';
import { spaceKindMeta } from '@/lib/radar/space';
import { radarLoc, radarT } from '@/lib/radar/i18n';

export function RadarAddParcelForm({
  locale,
  crops,
  busy,
  onSubmit,
  onCancel,
  compact,
  moduleId,
}: {
  locale: string;
  crops: RadarCrop[];
  busy?: boolean;
  onSubmit: (input: { name: string; crop?: string; areaHa?: number }) => Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
  moduleId?: string | null;
}) {
  const loc = radarLoc(locale);
  const meta = spaceKindMeta(moduleId);
  const [name, setName] = useState('');
  const [crop, setCrop] = useState('');
  const [area, setArea] = useState('');
  const [localBusy, setLocalBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) return;
    setLocalBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        crop: crop.trim() || undefined,
        areaHa: area ? Number(area) : undefined,
      });
      setName('');
      setCrop('');
      setArea('');
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <div
      className={
        compact
          ? 'rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4'
          : 'rounded-[1.35rem] border border-emerald-400/30 bg-emerald-500/10 px-5 py-5'
      }
    >
      <div className="flex items-center gap-2">
        <MapPinned className="h-4 w-4 text-emerald-200" />
        <p className="text-sm font-semibold text-emerald-50">
          {radarT(loc, `Nova ${meta.unitLabel.pt.toLowerCase()}`, `Nueva ${meta.unitLabel.es.toLowerCase()}`, `New ${meta.unitLabel.en.toLowerCase()}`)}
        </p>
      </div>
      <p className="mt-1 text-xs text-white/50">{meta.hint[loc]}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={meta.exampleName[loc]}
          className="rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40 sm:col-span-3"
          autoFocus
        />
        {crops.length > 0 ? (
          <select
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40 sm:col-span-2"
          >
            <option value="">
              {meta.secondaryLabel[loc]} ({loc === 'en' ? 'optional' : 'opcional'})
            </option>
            {crops.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
                {c.variety ? ` · ${c.variety}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            placeholder={`${meta.secondaryLabel[loc]} (${loc === 'en' ? 'optional' : 'opcional'})`}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40 sm:col-span-2"
          />
        )}
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          inputMode="decimal"
          placeholder={meta.areaUnit[loc]}
          className="rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={localBusy || busy || name.trim().length < 2}
          onClick={() => void submit()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-40"
        >
          {localBusy || busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {radarT(loc, 'Adicionar ao mapa', 'Agregar al mapa', 'Add to map')}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-xl px-3 py-2 text-sm text-white/55">
            {radarT(loc, 'Cancelar', 'Cancelar', 'Cancel')}
          </button>
        )}
      </div>
    </div>
  );
}
