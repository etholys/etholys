'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  ChevronRight,
  Loader2,
  MapPinned,
  Plus,
} from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RadarEntityActions } from '@/components/radar/RadarEntityActions';
import { RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';
import type { PropertyStepState } from '@/lib/radar/property-progress';
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
};

type AlertRow = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: { es: string; pt: string; en: string };
  propertyId: string | null;
  propertyName: string | null;
  href: string;
};

/** Company / client profile: alerts once + compact lugares with Abrir. */
export function RadarCompanyDashboard({
  companyId,
  engagementId,
  clientId,
  locale,
}: {
  companyId: string;
  engagementId?: string | null;
  clientId: string;
  locale: string;
}) {
  const loc = radarLoc(locale);
  const router = useRouter();
  const scopeCtx = useRadarClientScopeOptional();
  const setCreateOpen = scopeCtx?.setCreateOpen;
  const setScope = scopeCtx?.setScope;
  const refreshClients = scopeCtx?.refreshClients;
  const bumpListRevision = scopeCtx?.bumpListRevision;
  const listRevision = scopeCtx?.listRevision ?? 0;
  const clientFromCtx = scopeCtx?.clients.find((c) => c.id === clientId);

  const [clientName, setClientName] = useState(clientFromCtx?.name || '');
  const [contactName, setContactName] = useState(clientFromCtx?.contactName || null);
  const [properties, setProperties] = useState<PropRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const companyQ = useMemo(() => {
    const q = new URLSearchParams({ company: companyId, client: clientId });
    if (engagementId) q.set('engagement', engagementId);
    return q;
  }, [companyId, engagementId, clientId]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const base = new URLSearchParams({ companyId });
      if (engagementId) base.set('engagementId', engagementId);

      const pq = new URLSearchParams(base);
      pq.set('clientId', clientId);
      const aq = new URLSearchParams(base);
      aq.set('clientId', clientId);

      const [clientsRes, propsRes, alertsRes] = await Promise.all([
        fetch(`/api/radar/clients?${base}`, { cache: 'no-store' }),
        fetch(`/api/radar/properties?${pq}`, { cache: 'no-store' }),
        fetch(`/api/radar/alerts?${aq}`, { cache: 'no-store' }),
      ]);
      const clientsData = await clientsRes.json();
      const propsData = await propsRes.json();
      const alertsData = await alertsRes.json();

      if (!clientsRes.ok) throw new Error(clientsData.error || 'Falha');
      const row = (clientsData.clients || []).find((c: { id: string }) => c.id === clientId);
      if (!row) {
        router.replace(`/hub/radar?${new URLSearchParams({ company: companyId, client: RADAR_SCOPE_OWN })}`);
        return;
      }
      setClientName(row.name);
      setContactName(row.contactName ?? null);
      if (!propsRes.ok) throw new Error(propsData.error || 'Falha');
      setProperties(propsData.properties || []);
      setAlerts(alertsRes.ok ? alertsData.alerts || [] : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, clientId, router]);

  useEffect(() => {
    void load();
  }, [load, listRevision]);

  const afterEntityChange = useCallback(async () => {
    await refreshClients?.();
    bumpListRevision?.();
  }, [refreshClients, bumpListRevision]);

  const afterClientArchived = useCallback(async () => {
    await refreshClients?.();
    bumpListRevision?.();
    setScope?.(RADAR_SCOPE_OWN);
  }, [refreshClients, bumpListRevision, setScope]);

  useEffect(() => {
    // Align sidebar scope with this company page (no-op if already set).
    if (!scopeCtx || scopeCtx.scope === clientId) return;
    scopeCtx.setScope(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when route clientId changes
  }, [clientId]);

  const urgent = useMemo(
    () => alerts.filter((a) => a.severity === 'critical' || a.severity === 'warning'),
    [alerts],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (err) {
    return (
      <p className="rounded-xl border border-rose-400/40 bg-rose-950 px-3 py-2 text-sm text-rose-100">{err}</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => setScope?.(RADAR_SCOPE_OWN)}
            className="mb-2 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {radarT(loc, 'Voltar à operação', 'Volver a la operación', 'Back to operation')}
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {radarT(loc, 'Empresa / cliente', 'Empresa / cliente', 'Company / client')}
          </p>
          <h1 className="mt-1 font-serif text-3xl text-white md:text-4xl">{clientName}</h1>
          {contactName && <p className="mt-1 text-sm text-slate-300">{contactName}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RadarEntityActions
            kind="client"
            id={clientId}
            name={clientName || clientId}
            companyId={companyId}
            engagementId={engagementId}
            locale={loc}
            onDone={() => void afterClientArchived()}
          />
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

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/15 bg-slate-950 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {radarT(loc, 'Lugares', 'Lugares', 'Places')}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{properties.length}</p>
        </div>
        <Link
          href={`/hub/radar/tarefas?${companyQ}`}
          className="rounded-xl border border-amber-400/35 bg-amber-950 px-4 py-3"
        >
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">
            <Bell className="h-3 w-3" />
            {radarT(loc, 'Avisos', 'Avisos', 'Notices')}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-50">{urgent.length}</p>
        </Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-white">
          {radarT(loc, 'Precisa atenção', 'Necesita atención', 'Needs attention')}
        </h2>
        {urgent.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-400">
            {radarT(
              loc,
              'Sem avisos urgentes para esta empresa.',
              'Sin avisos urgentes para esta empresa.',
              'No urgent notices for this company.',
            )}
          </p>
        ) : (
          <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/15 bg-slate-950">
            {urgent.slice(0, 6).map((a) => (
              <li key={a.id}>
                <Link
                  href={a.href}
                  className="flex items-start gap-3 px-4 py-3 transition hover:bg-white/5"
                >
                  <AlertTriangle
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      a.severity === 'critical' ? 'text-rose-300' : 'text-amber-300'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-100">{a.message[loc]}</span>
                    {a.propertyName && (
                      <span className="mt-0.5 block truncate text-xs text-slate-400">{a.propertyName}</span>
                    )}
                  </span>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-white">
          {radarT(loc, 'Lugares desta empresa', 'Lugares de esta empresa', 'Places for this company')}
        </h2>
        {properties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-slate-950 px-6 py-10 text-center">
            <MapPinned className="mx-auto h-7 w-7 text-slate-500" />
            <p className="mt-3 text-sm text-slate-300">
              {radarT(
                loc,
                'Ainda sem espaços. Cria o primeiro (horta, agroindústria, animais…).',
                'Aún sin espacios. Creá el primero (huerta, agroindustria, animales…).',
                'No spaces yet. Create the first (garden, agroindustry, livestock…).',
              )}
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
          <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/15 bg-slate-950">
            {properties.map((p) => {
              const kind = spaceKindMeta(p.moduleId);
              const hasAlert = urgent.some((a) => a.propertyId === p.id);
              const openHref = `/hub/radar/properties/${p.id}?${companyQ}`;
              return (
                <li key={p.id}>
                  <div className="flex items-center gap-2 px-2 py-1.5 sm:px-3">
                    <button
                      type="button"
                      onClick={() => router.push(openHref)}
                      className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left hover:bg-white/5"
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">{p.name}</span>
                        {hasAlert && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">
                        {[
                          kind.unitLabelPlural[loc],
                          p.crop,
                          p.unitCount
                            ? `${p.unitCount} ${radarT(loc, 'unid.', 'unid.', 'units')}`
                            : null,
                          `${p.progressPercent}%`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                    <Link
                      href={openHref}
                      className="shrink-0 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/20"
                    >
                      {radarT(loc, 'Abrir', 'Abrir', 'Open')}
                    </Link>
                    <RadarEntityActions
                      kind="property"
                      id={p.id}
                      name={p.name}
                      companyId={companyId}
                      engagementId={engagementId}
                      locale={loc}
                      onDone={() => void afterEntityChange()}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
