'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, MapPinned, Plus } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RADAR_SCOPE_ALL, RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';
import type { PropertyStepState } from '@/lib/radar/property-progress';
import { RadarPlantPreview } from '@/components/radar/RadarPlantPreview';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import { spaceKindMeta } from '@/lib/radar/space';

type PropRow = {
  id: string;
  name: string;
  moduleId: string | null;
  crop: string | null;
  progressPercent: number;
  steps: PropertyStepState[];
  unitCount: number;
  clientId: string | null;
  clientName: string | null;
};

type AlertRow = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: { es: string; pt: string; en: string };
  propertyId: string | null;
  propertyName: string | null;
  href: string;
};

/** Home = pick a place (or open the only place). No stacked canvases. */
export function RadarHome({
  companyId,
  engagementId,
  locale,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
}) {
  const loc = radarLoc(locale);
  const router = useRouter();
  const scopeCtx = useRadarClientScopeOptional();
  const scope = scopeCtx?.scope || RADAR_SCOPE_OWN;
  const selectedClientId = scopeCtx?.selectedClientId || null;
  const isOwn = scope === RADAR_SCOPE_OWN;
  const isAll = scope === RADAR_SCOPE_ALL;
  const setCreateOpen = scopeCtx?.setCreateOpen;
  const listRevision = scopeCtx?.listRevision ?? 0;

  const [properties, setProperties] = useState<PropRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const base = new URLSearchParams({ companyId });
      if (engagementId) base.set('engagementId', engagementId);

      const pq = new URLSearchParams(base);
      if (isAll) pq.set('all', '1');
      else if (!isOwn && selectedClientId) pq.set('clientId', selectedClientId);

      const aq = new URLSearchParams(base);
      aq.set('clientId', scope);

      const [propsRes, alertsRes] = await Promise.all([
        fetch(`/api/radar/properties?${pq}`, { cache: 'no-store' }),
        fetch(`/api/radar/alerts?${aq}`, { cache: 'no-store' }),
      ]);
      const propsData = await propsRes.json();
      const alertsData = await alertsRes.json();
      if (!propsRes.ok) throw new Error(propsData.error || 'Falha');
      setProperties(propsData.properties || []);
      setAlerts(alertsRes.ok ? alertsData.alerts || [] : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, isAll, isOwn, scope, selectedClientId]);

  useEffect(() => {
    void load();
  }, [load, listRevision]);

  const companyQ = engagementId
    ? `company=${companyId}&engagement=${engagementId}`
    : `company=${companyId}`;

  const hrefFor = (p: PropRow) =>
    `/hub/radar/properties/${p.id}?${companyQ}&client=${p.clientId || RADAR_SCOPE_OWN}`;

  const urgentFor = (propertyId: string) =>
    alerts.filter((a) => a.propertyId === propertyId && (a.severity === 'critical' || a.severity === 'warning'));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (err) {
    return <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{err}</p>;
  }

  // ——— zero places ———
  if (properties.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-2 py-16 text-center">
        <MapPinned className="mx-auto h-10 w-10 text-emerald-300/80" />
        <h1 className="mt-5 font-serif text-3xl text-white">
          {radarT(loc, 'Onde trabalhas?', '¿Dónde trabajás?', 'Where do you work?')}
        </h1>
        <p className="mt-3 text-base text-white/60">
          {radarT(
            loc,
            'Cria o teu primeiro lugar — fazenda, planta ou curral.',
            'Creá tu primer lugar — finca, planta o corral.',
            'Create your first place — farm, plant or yard.',
          )}
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen?.('property')}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-[#04110c]"
        >
          <Plus className="h-5 w-5" />
          {radarT(loc, 'Criar lugar', 'Crear lugar', 'Create place')}
        </button>
      </div>
    );
  }

  // ——— one place: plant is the home ———
  if (properties.length === 1) {
    const p = properties[0];
    const openHref = hrefFor(p);
    const urgent = urgentFor(p.id);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl text-white md:text-4xl">{p.name}</h1>
            {p.crop && <p className="mt-1 text-sm text-white/50">{p.crop}</p>}
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen?.('property')}
            className="text-xs text-white/40 hover:text-white/70"
          >
            + {radarT(loc, 'Outro lugar', 'Otro lugar', 'Another place')}
          </button>
        </div>
        {urgent[0] && (
          <Link
            href={urgent[0].href}
            className="block rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-50"
          >
            {urgent[0].message[loc]}
          </Link>
        )}
        <p className="text-xs text-white/40">
          {radarT(loc, 'Toca um espaço para operar.', 'Tocá un espacio para operar.', 'Tap a space to operate.')}
        </p>
        <RadarPlantPreview
          companyId={companyId}
          engagementId={engagementId}
          propertyId={p.id}
          locale={loc}
          moduleId={p.moduleId}
          hero
          operateHrefFor={(unitId) => `${openHref}&unit=${unitId}`}
        />
      </div>
    );
  }

  // ——— many places: simple list ———
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-white md:text-4xl">
            {radarT(loc, 'Os teus lugares', 'Tus lugares', 'Your places')}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {radarT(loc, 'Escolhe onde vais trabalhar agora.', 'Elegí dónde vas a trabajar ahora.', 'Choose where to work now.')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen?.('property')}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c]"
        >
          <Plus className="h-4 w-4" />
          {radarT(loc, 'Novo lugar', 'Nuevo lugar', 'New place')}
        </button>
      </div>

      <ul className="space-y-2">
        {properties.map((p) => {
          const kind = spaceKindMeta(p.moduleId);
          const urgent = urgentFor(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => router.push(hrefFor(p))}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:border-emerald-400/35 hover:bg-emerald-500/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-medium text-white">{p.name}</p>
                  <p className="mt-0.5 truncate text-sm text-white/45">
                    {[kind.unitLabelPlural[loc], p.crop, p.clientName].filter(Boolean).join(' · ')}
                  </p>
                  {urgent[0] && (
                    <p className="mt-1 truncate text-xs text-amber-200/90">{urgent[0].message[loc]}</p>
                  )}
                </div>
                {urgent.length > 0 && (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_8px_currentColor]" />
                )}
                <ChevronRight className="h-5 w-5 shrink-0 text-white/30" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
