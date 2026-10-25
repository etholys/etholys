'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Loader2, Radio, Workflow } from 'lucide-react';
import { RADAR_DEVICE_CATALOG, deviceBySku } from '@/lib/radar/devices';
import { MOISTURE_THRESHOLD } from '@/lib/radar/agriculture';
import { radarLoc, radarT } from '@/lib/radar/i18n';

type PropertyRow = {
  id: string;
  name: string;
  moduleId: string | null;
  units: Array<{ id: string; name: string }>;
};

type Step = 1 | 2 | 3 | 4;

export function RadarAutomationWizard({
  companyId,
  engagementId,
  locale,
  initialPropertyId,
  qs,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
  initialPropertyId?: string | null;
  qs: string;
}) {
  const loc = radarLoc(locale);
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [propertyId, setPropertyId] = useState(initialPropertyId || '');
  const [unitId, setUnitId] = useState('');
  const [sku, setSku] = useState('SE01-LB');
  const [name, setName] = useState('');
  const [devEui, setDevEui] = useState('');
  const [wantRule, setWantRule] = useState(true);
  const [tokenFlash, setTokenFlash] = useState<string | null>(null);
  const [ingestPath, setIngestPath] = useState<string | null>(null);
  const [valveNote, setValveNote] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!companyId) return;
    const q = new URLSearchParams({ companyId, all: '1' });
    if (engagementId) q.set('engagementId', engagementId);
    void fetch(`/api/radar/properties?${q}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Erro');
        const rows = (Array.isArray(d.properties) ? d.properties : []) as Array<Record<string, unknown>>;
        const mapped: PropertyRow[] = rows.map((p) => ({
          id: String(p.id),
          name: String(p.name || ''),
          moduleId: (p.moduleId as string) || null,
          units: [],
        }));
        setProperties(mapped);
        const pick =
          (initialPropertyId && mapped.some((m) => m.id === initialPropertyId) && initialPropertyId) ||
          mapped[0]?.id ||
          '';
        if (pick) setPropertyId((prev) => prev || pick);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Erro'));
  }, [companyId, engagementId, initialPropertyId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadUnits = useCallback(
    (pid: string) => {
      if (!companyId || !pid) return;
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      void fetch(`/api/radar/properties/${pid}?${q}`, { cache: 'no-store' })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'Erro');
          const prop = (d.property || d) as Record<string, unknown>;
          const units = Array.isArray(prop.units)
            ? (prop.units as Array<Record<string, unknown>>).map((u) => ({
                id: String(u.id),
                name: String(u.name || ''),
              }))
            : [];
          setProperties((prev) =>
            prev.map((p) => (p.id === pid ? { ...p, units, moduleId: (prop.moduleId as string) || p.moduleId } : p)),
          );
          setUnitId((prev) => (units.some((u) => u.id === prev) ? prev : units[0]?.id || ''));
        })
        .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Erro'));
    },
    [companyId, engagementId],
  );

  useEffect(() => {
    if (propertyId) loadUnits(propertyId);
  }, [loadUnits, propertyId]);

  const property = useMemo(
    () => properties.find((p) => p.id === propertyId) || null,
    [properties, propertyId],
  );

  useEffect(() => {
    const profile = deviceBySku(sku);
    if (profile && !name) setName(profile.label[loc]);
  }, [sku, loc, name]);

  const bind = async () => {
    if (!propertyId || !name.trim()) return;
    setBusy(true);
    setErr(null);
    setTokenFlash(null);
    setValveNote(null);
    try {
      const res = await fetch(`/api/radar/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId: engagementId || undefined,
          action: 'sensor',
          name: name.trim(),
          sku,
          devEui: devEui.trim() || undefined,
          unitId: unitId || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erro');
      setTokenFlash(String(d.token || ''));
      setIngestPath(String(d.ingestPath || '/api/nexus/ingest/readings'));

      if (wantRule && sku === 'SE01-LB' && unitId) {
        // Ensure a valve exists on the same space for moisture→open (lorawan ingest already queues this).
        const valveRes = await fetch(`/api/radar/properties/${propertyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            engagementId: engagementId || undefined,
            action: 'sensor',
            name: radarT(loc, 'Válvula do espaço', 'Válvula del espacio', 'Space valve'),
            sku: 'SVC01-LS2',
            unitId,
          }),
        });
        const vd = await valveRes.json();
        if (valveRes.ok) {
          setValveNote(
            radarT(
              loc,
              `Regra activa: se humidade do solo < ${MOISTURE_THRESHOLD}%, o RADAR enfileira abrir a válvula neste espaço. Token da válvula (guarda uma vez): ${vd.token}`,
              `Regla activa: si humedad del suelo < ${MOISTURE_THRESHOLD}%, RADAR encola abrir la válvula en este espacio. Token de la válvula (guardalo una vez): ${vd.token}`,
              `Rule on: if soil moisture < ${MOISTURE_THRESHOLD}%, RADAR queues open valve on this space. Valve token (save once): ${vd.token}`,
            ),
          );
        } else {
          setValveNote(
            radarT(
              loc,
              'Sensor ligado. Para a regra humidade→válvula, adiciona também uma válvula (SVC01) no mesmo espaço.',
              'Sensor vinculado. Para la regla humedad→válvula, agregá también una válvula (SVC01) en el mismo espacio.',
              'Sensor bound. For moisture→valve, also add a valve (SVC01) on the same space.',
            ),
          );
        }
      }
      setStep(4);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const steps: Array<{ n: Step; label: string }> = [
    { n: 1, label: radarT(loc, 'Espaço', 'Espacio', 'Space') },
    { n: 2, label: radarT(loc, 'Aparelho', 'Equipo', 'Device') },
    { n: 3, label: radarT(loc, 'Regra', 'Regla', 'Rule') },
    { n: 4, label: radarT(loc, 'Pronto', 'Listo', 'Done') },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-200/70">
          {radarT(loc, 'Automatização', 'Automatización', 'Automation')}
        </p>
        <h1 className="mt-1 font-serif text-3xl text-white">
          {radarT(loc, 'Começar automatização', 'Empezar automatización', 'Start automation')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          {radarT(
            loc,
            'Escolhe o espaço, liga um aparelho do catálogo e, se quiseres, a regra humidade → válvula (já usada no ingest).',
            'Elegí el espacio, vinculá un equipo del catálogo y, si querés, la regla humedad → válvula (ya usada en el ingest).',
            'Pick a space, bind a catalog device, and optionally the moisture → valve rule (already used on ingest).',
          )}
        </p>
        <Link
          href={`/hub/radar/assistente${qs}`}
          className="mt-3 inline-block text-xs text-teal-200/80 hover:text-teal-100"
        >
          ← {radarT(loc, 'Voltar ao Assistente', 'Volver al Asistente', 'Back to Assistant')}
        </Link>
      </header>

      <ol className="mb-8 flex flex-wrap gap-2">
        {steps.map((s) => (
          <li
            key={s.n}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              step === s.n
                ? 'bg-teal-400 text-slate-950'
                : step > s.n
                  ? 'bg-teal-500/20 text-teal-100'
                  : 'bg-white/5 text-white/40'
            }`}
          >
            {step > s.n ? <Check className="h-3 w-3" /> : s.n}
            {s.label}
          </li>
        ))}
      </ol>

      {err && <p className="mb-4 text-sm text-rose-200">{err}</p>}

      {step === 1 && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs text-white/45">
              {radarT(loc, 'Propriedade', 'Propiedad', 'Property')}
            </span>
            <select
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setUnitId('');
              }}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a1620] px-3 py-3 text-sm text-white"
            >
              {properties.length === 0 && (
                <option value="">{radarT(loc, 'Sem propriedades', 'Sin propiedades', 'No properties')}</option>
              )}
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-white/45">{radarT(loc, 'Espaço', 'Espacio', 'Space')}</span>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a1620] px-3 py-3 text-sm text-white"
            >
              {(property?.units || []).length === 0 && (
                <option value="">
                  {radarT(loc, 'Cria um espaço no mapa primeiro', 'Creá un espacio en el mapa primero', 'Create a space on the map first')}
                </option>
              )}
              {(property?.units || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!propertyId || !unitId}
            onClick={() => setStep(2)}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
          >
            {radarT(loc, 'Seguinte', 'Siguiente', 'Next')}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-white/45">{radarT(loc, 'Catálogo RADAR', 'Catálogo RADAR', 'RADAR catalog')}</p>
          <div className="space-y-2">
            {RADAR_DEVICE_CATALOG.map((d) => (
              <button
                key={d.sku}
                type="button"
                onClick={() => {
                  setSku(d.sku);
                  setName(d.label[loc]);
                }}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  sku === d.sku
                    ? 'border-teal-400/50 bg-teal-500/10'
                    : 'border-white/10 bg-[#0a1620] hover:border-white/25'
                }`}
              >
                <Radio className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                <span>
                  <span className="block text-sm font-medium text-white">
                    {d.sku} — {d.label[loc]}
                  </span>
                  <span className="text-xs text-white/40">{d.role}</span>
                </span>
              </button>
            ))}
          </div>
          <label className="block">
            <span className="text-xs text-white/45">{radarT(loc, 'Nome no sítio', 'Nombre en el sitio', 'Name on site')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a1620] px-3 py-3 text-sm text-white outline-none focus:border-teal-400/40"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/45">DevEUI {radarT(loc, '(opcional)', '(opcional)', '(optional)')}</span>
            <input
              value={devEui}
              onChange={(e) => setDevEui(e.target.value)}
              placeholder="AABBCCDDEEFF0011"
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a1620] px-3 py-3 font-mono text-sm text-white outline-none focus:border-teal-400/40"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl px-4 py-3 text-sm text-white/50 hover:text-white"
            >
              {radarT(loc, 'Voltar', 'Volver', 'Back')}
            </button>
            <button
              type="button"
              disabled={name.trim().length < 2}
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
            >
              {radarT(loc, 'Seguinte', 'Siguiente', 'Next')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#0a1620] px-4 py-4 text-sm text-white/75">
            <p className="flex items-center gap-2 font-medium text-white">
              <Workflow className="h-4 w-4 text-teal-300" />
              {radarT(loc, 'Regra humidade → válvula', 'Regla humedad → válvula', 'Moisture → valve rule')}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/50">
              {radarT(
                loc,
                `Quando o sensor de solo neste espaço reporta humidade abaixo de ${MOISTURE_THRESHOLD}%, o RADAR enfileira um comando «abrir» para a válvula do mesmo espaço. Não precisas de reconstruir o rádio — o ingest já faz isto.`,
                `Cuando el sensor de suelo en este espacio reporta humedad bajo ${MOISTURE_THRESHOLD}%, RADAR encola un comando «abrir» para la válvula del mismo espacio. No hace falta reconstruir la radio — el ingest ya lo hace.`,
                `When the soil sensor on this space reports moisture below ${MOISTURE_THRESHOLD}%, RADAR queues an “open” command for the valve on the same space. No radio rebuild — ingest already does this.`,
              )}
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={wantRule}
                onChange={(e) => setWantRule(e.target.checked)}
                className="rounded border-white/30"
              />
              {radarT(
                loc,
                'Criar também uma válvula neste espaço (recomendado com SE01)',
                'Crear también una válvula en este espacio (recomendado con SE01)',
                'Also create a valve on this space (recommended with SE01)',
              )}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-xl px-4 py-3 text-sm text-white/50 hover:text-white"
            >
              {radarT(loc, 'Voltar', 'Volver', 'Back')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void bind()}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {radarT(loc, 'Ligar aparelho', 'Vincular equipo', 'Bind device')}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 rounded-xl border border-teal-400/30 bg-teal-500/5 px-5 py-5">
          <p className="text-sm font-medium text-teal-100">
            {radarT(loc, 'Aparelho ligado', 'Equipo vinculado', 'Device bound')}
          </p>
          {tokenFlash && (
            <div>
              <p className="text-xs text-white/45">
                {radarT(loc, 'Token (mostra-se uma vez)', 'Token (se muestra una vez)', 'Token (shown once)')}
              </p>
              <code className="mt-1 block break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-emerald-200">
                {tokenFlash}
              </code>
              {ingestPath && (
                <p className="mt-2 text-xs text-white/40">
                  {radarT(loc, 'Ingest', 'Ingest', 'Ingest')}: {ingestPath}
                </p>
              )}
            </div>
          )}
          {valveNote && <p className="text-xs leading-relaxed text-white/60">{valveNote}</p>}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={`/hub/radar/properties/${propertyId}${qs}`}
              className="rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-slate-950"
            >
              {radarT(loc, 'Abrir o lugar', 'Abrir el sitio', 'Open the place')}
            </Link>
            <Link
              href={`/hub/radar/assistente${qs}`}
              className="rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white/80"
            >
              {radarT(loc, 'Assistente', 'Asistente', 'Assistant')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
