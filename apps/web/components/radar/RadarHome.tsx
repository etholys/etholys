'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, MapPinned, Plus, Radio } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RADAR_SCOPE_ALL, RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';
import type { PropertyStepState } from '@/lib/radar/property-progress';

type Loc = 'pt' | 'es' | 'en';

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

const MODULE_LABEL: Record<string, { pt: string; es: string; en: string }> = {
  agriculture: { pt: 'Lavoura', es: 'Cultivo', en: 'Fields' },
  agroindustry: { pt: 'Agroindústria', es: 'Agroindustria', en: 'Agro-industry' },
  livestock: { pt: 'Pecuária', es: 'Ganadería', en: 'Livestock' },
  carbon: { pt: 'Carbono', es: 'Carbono', en: 'Carbon' },
};

function moduleTone(moduleId: string | null) {
  if (moduleId === 'agroindustry') return 'from-slate-500/30 to-slate-900/60 border-slate-300/25';
  if (moduleId === 'livestock') return 'from-amber-500/25 to-amber-950/50 border-amber-300/30';
  if (moduleId === 'carbon') return 'from-cyan-500/20 to-cyan-950/50 border-cyan-300/25';
  return 'from-emerald-500/30 to-emerald-950/55 border-emerald-300/30';
}

function layoutSlots(n: number): Array<{ x: number; y: number; w: number; h: number }> {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 12, y: 18, w: 76, h: 58 }];
  if (n === 2)
    return [
      { x: 6, y: 16, w: 42, h: 62 },
      { x: 52, y: 16, w: 42, h: 62 },
    ];
  if (n === 3)
    return [
      { x: 4, y: 12, w: 44, h: 44 },
      { x: 52, y: 12, w: 44, h: 44 },
      { x: 22, y: 60, w: 56, h: 32 },
    ];
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const gap = 3;
  const cellW = (100 - gap * (cols + 1)) / cols;
  const cellH = (100 - gap * (rows + 1)) / rows;
  return Array.from({ length: n }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      x: gap + col * (cellW + gap),
      y: gap + row * (cellH + gap),
      w: cellW,
      h: cellH * 0.92,
    };
  });
}

export function RadarHome({
  companyId,
  engagementId,
  locale,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
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

  useEffect(() => {
    if (!selectedId && properties[0]) setSelectedId(properties[0].id);
  }, [properties, selectedId]);

  const companyQ = engagementId
    ? `company=${companyId}&engagement=${engagementId}`
    : `company=${companyId}`;

  const slots = useMemo(() => layoutSlots(properties.length), [properties.length]);
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

  const alertsByProperty = useMemo(() => {
    const m = new Map<string, AlertRow[]>();
    for (const a of alerts) {
      if (!a.propertyId) continue;
      const list = m.get(a.propertyId) || [];
      list.push(a);
      m.set(a.propertyId, list);
    }
    return m;
  }, [alerts]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">RADAR</p>
          <h1 className="mt-1 font-serif text-3xl text-white md:text-4xl">
            {loc === 'es' ? 'Tu operación' : loc === 'en' ? 'Your operation' : 'A tua operação'}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {urgentCount > 0 && (
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              className="rounded-full border border-amber-400/35 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-100"
            >
              {urgentCount} {loc === 'en' ? 'attention' : 'atenção'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen?.('property')}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c]"
          >
            <Plus className="h-4 w-4" />
            {loc === 'en' ? 'New space' : 'Novo espaço'}
          </button>
        </div>
      </div>

      {err && <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{err}</p>}

      {drawerOpen && urgentCount > 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            {loc === 'en' ? 'Needs attention' : 'Precisa de atenção'}
          </p>
          <ul className="mt-2 space-y-2">
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
          <Link
            href={`/hub/radar/tarefas?${companyQ}`}
            className="mt-3 inline-block text-xs text-emerald-300/80 hover:text-emerald-200"
          >
            {loc === 'en' ? 'All tasks →' : 'Todas as tarefas →'}
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
        </div>
      ) : properties.length === 0 ? (
        <div className="relative overflow-hidden rounded-[1.5rem] border border-dashed border-white/15 bg-gradient-to-br from-emerald-950/40 to-[#07111A] px-6 py-16 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_30%_40%,rgba(52,211,153,0.25),transparent_45%),radial-gradient(circle_at_70%_60%,rgba(56,189,248,0.15),transparent_40%)]" />
          <MapPinned className="relative mx-auto h-8 w-8 text-emerald-300/80" />
          <p className="relative mt-4 text-base text-white/70">
            {loc === 'es'
              ? 'Empezá dibujando tu primer espacio en el mapa.'
              : loc === 'en'
                ? 'Start by placing your first space on the map.'
                : 'Começa por colocar o teu primeiro espaço no mapa.'}
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen?.('property')}
            className="relative mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c]"
          >
            <Plus className="h-4 w-4" />
            {loc === 'en' ? 'New space' : 'Novo espaço'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Tree */}
          <aside className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              {loc === 'en' ? 'Spaces' : 'Espaços'}
            </p>
            <ul className="space-y-3">
              {treeGroups.map(([moduleId, rows]) => (
                <li key={moduleId}>
                  <p className="px-1 text-[11px] font-medium text-white/50">
                    {(MODULE_LABEL[moduleId] || MODULE_LABEL.agriculture)[loc]}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {rows.map((p) => {
                      const active = p.id === selected?.id;
                      const n = alertsByProperty.get(p.id)?.length || 0;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(p.id)}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                              active ? 'bg-emerald-500/20 text-emerald-50' : 'text-white/70 hover:bg-white/5'
                            }`}
                          >
                            <span className="truncate">{p.name}</span>
                            {n > 0 && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title={`${n}`} />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </aside>

          {/* Map canvas */}
          <div className="space-y-3">
            <div
              className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0a1620]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-900/20 via-transparent to-emerald-950/40" />
              {properties.map((p, i) => {
                const slot = slots[i] || slots[0];
                const active = p.id === selected?.id;
                const pins = alertsByProperty.get(p.id) || [];
                const worst = pins.find((a) => a.severity === 'critical')
                  ? 'critical'
                  : pins.find((a) => a.severity === 'warning')
                    ? 'warning'
                    : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`absolute overflow-hidden rounded-2xl border bg-gradient-to-br p-3 text-left shadow-lg transition ${moduleTone(
                      p.moduleId,
                    )} ${active ? 'z-10 ring-2 ring-emerald-300/70' : 'z-0 opacity-90 hover:opacity-100'}`}
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      width: `${slot.w}%`,
                      height: `${slot.h}%`,
                      transform: active ? 'translateY(-2px)' : undefined,
                    }}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-white/55">
                          {[
                            (MODULE_LABEL[p.moduleId || 'agriculture'] || MODULE_LABEL.agriculture)[loc],
                            p.crop,
                            p.clientName || (isOwn ? null : null),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.unitCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] text-white/70">
                            <Radio className="h-3 w-3 text-sky-300" />
                            {p.unitCount}
                          </span>
                        )}
                        {worst && (
                          <span
                            className={`h-2 w-2 rounded-full ${
                              worst === 'critical' ? 'bg-rose-400' : 'bg-amber-400'
                            } shadow-[0_0_8px_currentColor]`}
                          />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Focus sheet — one place, few actions */}
            {selected && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      {(MODULE_LABEL[selected.moduleId || 'agriculture'] || MODULE_LABEL.agriculture)[loc]}
                    </p>
                    <h2 className="mt-0.5 text-xl font-medium text-white">{selected.name}</h2>
                    {selected.crop && <p className="mt-1 text-sm text-white/50">{selected.crop}</p>}
                  </div>
                  <Link
                    href={`/hub/radar/properties/${selected.id}?${companyQ}&client=${selected.clientId || RADAR_SCOPE_OWN}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c]"
                  >
                    <MapPinned className="h-4 w-4" />
                    {loc === 'en' ? 'Open place' : 'Abrir local'}
                  </Link>
                </div>
                {selectedAlerts.length > 0 ? (
                  <ul className="mt-4 space-y-2 border-t border-white/10 pt-3">
                    {selectedAlerts.slice(0, 2).map((a) => (
                      <li key={a.id}>
                        <Link href={a.href} className="text-sm text-white/75 hover:text-emerald-200">
                          {a.message[loc]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-white/40">
                    {loc === 'es' ? 'Sin avisos en este espacio.' : loc === 'en' ? 'No notices here.' : 'Sem avisos neste espaço.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
