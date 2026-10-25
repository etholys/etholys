'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
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
import { cn } from '@/lib/utils';

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

  const topAlert = urgent[0] || null;
  const metaLine = [
    `${properties.length} ${radarT(loc, 'lugares', 'lugares', 'places')}`,
    urgent.length
      ? `${urgent.length} ${radarT(loc, 'avisos', 'avisos', 'notices')}`
      : radarT(loc, 'sem urgências', 'sin urgencias', 'no urgencies'),
  ].join(' · ');

  return (
    <div className="relative space-y-8 pb-8">
      <header className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <button
            type="button"
            onClick={() => setScope?.(RADAR_SCOPE_OWN)}
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-emerald-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {radarT(loc, 'Voltar à operação', 'Volver a la operación', 'Back to operation')}
          </button>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300/80">
            {radarT(loc, 'Empresa', 'Empresa', 'Company')}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-etholys-display)] text-3xl tracking-tight text-white md:text-4xl">
            {clientName}
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {[contactName, metaLine].filter(Boolean).join(' · ')}
          </p>
          {topAlert ? (
            <Link
              href={topAlert.href}
              className="mt-4 inline-flex max-w-full items-start gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3.5 py-2 text-left transition hover:border-amber-400/40 hover:bg-amber-500/15"
            >
              <AlertTriangle
                className={cn(
                  'mt-0.5 h-3.5 w-3.5 shrink-0',
                  topAlert.severity === 'critical' ? 'text-rose-300' : 'text-amber-300',
                )}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm text-amber-50">{topAlert.message[loc]}</span>
                {topAlert.propertyName ? (
                  <span className="block truncate text-[11px] text-amber-100/55">{topAlert.propertyName}</span>
                ) : null}
              </span>
            </Link>
          ) : (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-200/90">
              <CheckCircle2 className="h-4 w-4" />
              {radarT(loc, 'Sem avisos urgentes.', 'Sin avisos urgentes.', 'No urgent notices.')}
            </p>
          )}
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
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c] shadow-[0_0_24px_-6px_rgba(16,185,129,0.55)]"
          >
            <Plus className="h-4 w-4" />
            {radarT(loc, 'Novo espaço', 'Nuevo espacio', 'New space')}
          </button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.85fr)] lg:items-start">
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">
              {radarT(loc, 'Lugares', 'Lugares', 'Places')}
            </h2>
            <button
              type="button"
              onClick={() => setCreateOpen?.('property')}
              className="text-xs font-medium text-emerald-300/90 hover:text-emerald-200"
            >
              + {radarT(loc, 'Novo', 'Nuevo', 'New')}
            </button>
          </div>
          {properties.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
              <MapPinned className="mx-auto h-7 w-7 text-white/35" />
              <p className="mt-3 text-sm text-white/50">
                {radarT(
                  loc,
                  'Ainda sem espaços. Cria o primeiro.',
                  'Aún sin espacios. Creá el primero.',
                  'No spaces yet. Create the first.',
                )}
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {properties.map((p) => {
                const kind = spaceKindMeta(p.moduleId);
                const placeAlerts = urgent.filter((a) => a.propertyId === p.id);
                const worst = placeAlerts.find((a) => a.severity === 'critical') || placeAlerts[0];
                const openHref = `/hub/radar/properties/${p.id}?${companyQ}`;
                const settingsHref = `${openHref}&settings=1`;
                return (
                  <li key={p.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => router.push(openHref)}
                      className="flex h-full w-full flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent p-4 text-left transition hover:border-emerald-400/35 hover:from-emerald-500/[0.08]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-semibold text-white">{p.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-white/40">
                            {[kind.unitLabelPlural[loc], p.crop].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'mt-1 h-2 w-2 shrink-0 rounded-full',
                            worst
                              ? worst.severity === 'critical'
                                ? 'bg-rose-400'
                                : 'bg-amber-400'
                              : 'bg-emerald-400/50',
                          )}
                        />
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-2">
                        <span className="text-xs tabular-nums text-white/45">
                          {p.unitCount
                            ? `${p.unitCount} ${radarT(loc, 'unid.', 'unid.', 'units')}`
                            : radarT(loc, 'Sem unidades', 'Sin unidades', 'No units')}
                        </span>
                        <span className="text-xs font-medium text-emerald-300 opacity-0 transition group-hover:opacity-100">
                          {radarT(loc, 'Abrir mapa', 'Abrir mapa', 'Open map')} →
                        </span>
                      </div>
                    </button>
                    <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                      <RadarEntityActions
                        kind="property"
                        id={p.id}
                        name={p.name}
                        companyId={companyId}
                        engagementId={engagementId}
                        locale={loc}
                        settingsHref={settingsHref}
                        onDone={() => void afterEntityChange()}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="lg:sticky lg:top-4">
          <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a1620]/90">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-sm font-semibold text-white">
                {radarT(loc, 'Agora', 'Ahora', 'Now')}
              </h2>
              {urgent.length > 0 && (
                <Link
                  href={`/hub/radar/tarefas?${companyQ}`}
                  className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
                >
                  {radarT(loc, 'Tarefas', 'Tareas', 'Tasks')}
                </Link>
              )}
            </div>
            {urgent.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-400/80" />
                <p className="text-sm text-white/55">
                  {radarT(loc, 'Nada urgente nesta empresa.', 'Nada urgente en esta empresa.', 'Nothing urgent for this company.')}
                </p>
              </div>
            ) : (
              <ul>
                {urgent.slice(0, 6).map((a, i) => (
                  <li key={a.id} className={cn(i > 0 && 'border-t border-white/[0.06]')}>
                    <Link href={a.href} className="flex gap-3 px-4 py-3.5 transition hover:bg-white/[0.04]">
                      <span
                        className={cn(
                          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                          a.severity === 'critical' ? 'bg-rose-400' : 'bg-amber-400',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug text-white/90">{a.message[loc]}</span>
                        {a.propertyName ? (
                          <span className="mt-1 block truncate text-[11px] text-white/35">{a.propertyName}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
