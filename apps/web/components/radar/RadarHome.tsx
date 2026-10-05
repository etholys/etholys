'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, MapPinned, Plus } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RADAR_SCOPE_ALL, RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';
import type { PropertyStepState } from '@/lib/radar/property-progress';
import { RadarOpsCanvas } from '@/components/radar/RadarOpsCanvas';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import type { TraceStage } from '@/lib/radar/trace';

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

type LotRow = {
  id: string;
  code: string;
  currentStage: TraceStage;
  status: string;
  unitName: string | null;
};

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
  const scopeCtx = useRadarClientScopeOptional();
  const scope = scopeCtx?.scope || RADAR_SCOPE_OWN;
  const selectedClientId = scopeCtx?.selectedClientId || null;
  const isOwn = scope === RADAR_SCOPE_OWN;
  const isAll = scope === RADAR_SCOPE_ALL;
  const setCreateOpen = scopeCtx?.setCreateOpen;
  const listRevision = scopeCtx?.listRevision ?? 0;

  const [properties, setProperties] = useState<PropRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

      const [propsRes, alertsRes, lotsRes] = await Promise.all([
        fetch(`/api/radar/properties?${pq}`, { cache: 'no-store' }),
        fetch(`/api/radar/alerts?${aq}`, { cache: 'no-store' }),
        fetch(`/api/radar/lots?${base}`, { cache: 'no-store' }),
      ]);
      const propsData = await propsRes.json();
      const alertsData = await alertsRes.json();
      const lotsData = await lotsRes.json().catch(() => ({}));
      if (!propsRes.ok) throw new Error(propsData.error || 'Falha');
      setProperties(propsData.properties || []);
      setAlerts(alertsRes.ok ? alertsData.alerts || [] : []);
      setLots(lotsRes.ok ? lotsData.lots || [] : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, isAll, isOwn, scope, selectedClientId]);

  useEffect(() => {
    void load();
  }, [load, listRevision]);

  useEffect(() => {
    if (!selectedId && properties[0]) setSelectedId(properties[0].id);
  }, [properties, selectedId]);

  const companyQ = engagementId
    ? `company=${companyId}&engagement=${engagementId}`
    : `company=${companyId}`;

  const selected = properties.find((p) => p.id === selectedId) || properties[0] || null;
  const selectedAlerts = alerts.filter((a) => a.propertyId === selected?.id);
  const urgentCount = alerts.filter((a) => a.severity === 'critical' || a.severity === 'warning').length;

  const treeGroups = useMemo(() => {
    const map = new Map<string, PropRow[]>();
    for (const p of properties) {
      const key = p.moduleId || 'agriculture';
      const list = map.get(key) || [];
      list.push(p);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [properties]);

  const MODULE_LABEL: Record<string, { pt: string; es: string; en: string }> = {
    agriculture: { pt: 'Lavoura', es: 'Cultivo', en: 'Fields' },
    agroindustry: { pt: 'Agroindústria', es: 'Agroindustria', en: 'Agro-industry' },
    livestock: { pt: 'Pecuária', es: 'Ganadería', en: 'Livestock' },
    carbon: { pt: 'Carbono', es: 'Carbono', en: 'Carbon' },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">RADAR</p>
          <h1 className="mt-1 font-serif text-3xl text-white md:text-4xl">
            {radarT(loc, 'A tua operação', 'Tu operación', 'Your operation')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {urgentCount > 0 && (
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              className="rounded-full border border-amber-400/35 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-100"
            >
              {urgentCount} {radarT(loc, 'atenção', 'atención', 'attention')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen?.('property')}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c]"
          >
            <Plus className="h-4 w-4" />
            {radarT(loc, 'Novo espaço', 'Nuevo espacio', 'New space')}
          </button>
        </div>
      </div>

      {err && <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{err}</p>}

      {drawerOpen && urgentCount > 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
          <ul className="space-y-2">
            {alerts
              .filter((a) => a.severity !== 'info')
              .slice(0, 5)
              .map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className="block text-sm text-white/80 hover:text-emerald-200">
                    {a.message[loc]}
                    {a.propertyName ? <span className="text-white/40"> · {a.propertyName}</span> : null}
                  </Link>
                </li>
              ))}
          </ul>
          <Link href={`/hub/radar/tarefas?${companyQ}`} className="mt-3 inline-block text-xs text-emerald-300/80">
            {radarT(loc, 'Todas as tarefas →', 'Todas las tareas →', 'All tasks →')}
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
        </div>
      ) : properties.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-white/15 px-6 py-16 text-center">
          <MapPinned className="mx-auto h-8 w-8 text-emerald-300/80" />
          <p className="mt-4 text-base text-white/70">
            {radarT(loc, 'Começa por colocar o teu primeiro espaço no mapa.', 'Empezá colocando tu primer espacio en el mapa.', 'Start by placing your first space on the map.')}
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen?.('property')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c]"
          >
            <Plus className="h-4 w-4" />
            {radarT(loc, 'Novo espaço', 'Nuevo espacio', 'New space')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              {radarT(loc, 'Espaços', 'Espacios', 'Spaces')}
            </p>
            <ul className="space-y-3">
              {treeGroups.map(([moduleId, rows]) => (
                <li key={moduleId}>
                  <p className="px-1 text-[11px] font-medium text-white/50">
                    {(MODULE_LABEL[moduleId] || MODULE_LABEL.agriculture)[loc]}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {rows.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(p.id)}
                          className={`w-full truncate rounded-lg px-2 py-1.5 text-left text-sm ${
                            p.id === selected?.id ? 'bg-emerald-500/20 text-emerald-50' : 'text-white/70 hover:bg-white/5'
                          }`}
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </aside>

          <div className="space-y-3">
            <RadarOpsCanvas
              locale={loc}
              properties={properties}
              alerts={alerts}
              lots={lots}
              selectedId={selected?.id || null}
              onSelect={setSelectedId}
              hrefFor={(id) => {
                const p = properties.find((x) => x.id === id);
                return `/hub/radar/properties/${id}?${companyQ}&client=${p?.clientId || RADAR_SCOPE_OWN}`;
              }}
            />

            {selected && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-medium text-white">{selected.name}</h2>
                    {selected.crop && <p className="mt-1 text-sm text-white/50">{selected.crop}</p>}
                  </div>
                  <Link
                    href={`/hub/radar/properties/${selected.id}?${companyQ}&client=${selected.clientId || RADAR_SCOPE_OWN}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c]"
                  >
                    <MapPinned className="h-4 w-4" />
                    {radarT(loc, 'Abrir local', 'Abrir lugar', 'Open place')}
                  </Link>
                </div>
                {selectedAlerts.length > 0 ? (
                  <ul className="mt-3 space-y-1 border-t border-white/10 pt-3">
                    {selectedAlerts.slice(0, 2).map((a) => (
                      <li key={a.id}>
                        <Link href={a.href} className="text-sm text-white/75 hover:text-emerald-200">
                          {a.message[loc]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
