'use client';

import { useState } from 'react';
import { ArrowRight, Leaf, Factory, Beef, LeafyGreen, Loader2 } from 'lucide-react';
import { RADAR_MODULES, type RadarModuleId } from '@/lib/etholys-products';
import { RADAR_SPACE_KINDS, isRadarModuleId } from '@/lib/radar/space';

type Loc = 'pt' | 'es' | 'en';

const ICONS = {
  agriculture: Leaf,
  agroindustry: Factory,
  livestock: Beef,
  carbon: LeafyGreen,
} as const;

const COPY = {
  pt: {
    title: 'Registar espaço de medição',
    sub: 'Diz o que vais medir. O tipo define o laço — sensores, alertas e cadeia.',
    name: 'Nome do espaço',
    namePh: 'Ex.: Parcela Norte, Galpão 2, Lote A',
    type: 'Do que se trata',
    continue: 'Continuar',
    crop: 'Cultura / produto (opcional)',
    area: 'Área ha (opcional)',
  },
  es: {
    title: 'Registrar espacio de medición',
    sub: 'Decí qué vas a medir. El tipo define el lazo — sensores, alertas y cadena.',
    name: 'Nombre del espacio',
    namePh: 'Ej.: Parcela Norte, Galpón 2, Lote A',
    type: 'De qué se trata',
    continue: 'Continuar',
    crop: 'Cultivo / producto (opcional)',
    area: 'Área ha (opcional)',
  },
  en: {
    title: 'Register measurement space',
    sub: 'Say what you will measure. Type sets the loop — sensors, alerts and chain.',
    name: 'Space name',
    namePh: 'e.g. North plot, Shed 2, Lot A',
    type: 'What is it',
    continue: 'Continue',
    crop: 'Crop / product (optional)',
    area: 'Area ha (optional)',
  },
} as const;

export function RadarSpaceSetup({
  companyId,
  engagementId,
  locale,
  onCreated,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
  onCreated: (moduleId: RadarModuleId) => void;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const copy = COPY[loc];
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [moduleId, setModuleId] = useState<RadarModuleId | null>(null);
  const [crop, setCrop] = useState('');
  const [area, setArea] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!moduleId || name.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    try {
      await fetch('/api/business-dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, pulsoModule: moduleId }),
      });
      const r = await fetch('/api/radar/agriculture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          action: 'open',
          name: name.trim(),
          crop: crop.trim() || undefined,
          areaHa: area ? Number(area) : undefined,
          moduleId,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      onCreated(moduleId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-emerald-500/10 via-white/[0.03] to-violet-500/10 px-6 py-8 sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/70">RADAR</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight text-white sm:text-5xl">{copy.title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">{copy.sub}</p>

        <div className="mt-8 flex gap-2">
          <span className={`h-1.5 w-10 rounded-full ${step === 1 ? 'bg-emerald-400' : 'bg-white/20'}`} />
          <span className={`h-1.5 w-10 rounded-full ${step === 2 ? 'bg-emerald-400' : 'bg-white/20'}`} />
        </div>

        {err && <p className="mt-4 text-sm text-rose-200">{err}</p>}

        {step === 1 && (
          <div className="mt-8 space-y-6">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-white/45">{copy.name}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={copy.namePh}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3.5 text-base text-white outline-none ring-emerald-400/40 placeholder:text-white/30 focus:ring-2"
                autoFocus
              />
            </label>

            <div>
              <p className="text-xs uppercase tracking-wide text-white/45">{copy.type}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {RADAR_MODULES.map((m) => {
                  const Icon = ICONS[m.id as RadarModuleId];
                  const active = moduleId === m.id;
                  const kind = RADAR_SPACE_KINDS[m.id as RadarModuleId];
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => isRadarModuleId(m.id) && setModuleId(m.id)}
                      className={`group rounded-2xl border px-4 py-4 text-left transition ${
                        active
                          ? 'border-emerald-400/50 bg-emerald-500/15 shadow-[0_0_0_1px_rgba(52,211,153,0.2)]'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            active ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/5 text-white/50'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-white">{m[loc]}</p>
                          <p className="mt-0.5 text-xs text-white/45">{m.hint[loc]}</p>
                          <p className="mt-2 text-[11px] uppercase tracking-wide text-white/35">{kind.unitLabel[loc]}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={name.trim().length < 2 || !moduleId}
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#04110c] disabled:opacity-40"
            >
              {copy.continue}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 2 && moduleId && (
          <div className="mt-8 space-y-5">
            <p className="text-sm text-white/70">
              <span className="font-medium text-white">{name}</span>
              <span className="text-white/40"> · </span>
              {moduleMetaLabel(moduleId, loc)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-white/45">{copy.crop}</span>
                <input
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-white/45">{copy.area}</span>
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  inputMode="decimal"
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-2xl border border-white/15 px-4 py-3 text-sm text-white/70"
              >
                ←
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#04110c] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {copy.continue}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function moduleMetaLabel(id: RadarModuleId, loc: Loc) {
  const m = RADAR_MODULES.find((x) => x.id === id);
  return m ? m[loc] : id;
}
