'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  MapPinned,
  Plus,
} from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RADAR_SCOPE_ALL, RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';
import type { PropertyStepState } from '@/lib/radar/property-progress';
import { RadarEntityActions } from '@/components/radar/RadarEntityActions';
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
  clientId: string | null;
  clientName: string | null;
};

type AlertRow = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: { es: string; pt: string; en: string };
  propertyId: string | null;
  propertyName: string | null;
  clientId: string | null;
  clientName: string | null;
  href: string;
};

type ClientRow = {
  id: string;
  name: string;
  propertyCount: number;
  contactName: string | null;
};

/** Ops dashboard — one composition: places to open + what needs action. */
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
  const setScope = scopeCtx?.setScope;
  const refreshClients = scopeCtx?.refreshClients;
  const bumpListRevision = scopeCtx?.bumpListRevision;
  const clientsFromCtx = scopeCtx?.clients || [];
  const listRevision = scopeCtx?.listRevision ?? 0;

  const [properties, setProperties] = useState<PropRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const afterEntityChange = useCallback(async () => {
    await refreshClients?.();
    bumpListRevision?.();
  }, [refreshClients, bumpListRevision]);

  useEffect(() => {
    if (!selectedClientId || !companyId) return;
    const q = new URLSearchParams({ company: companyId, client: selectedClientId });
    if (engagementId) q.set('engagement', engagementId);
    router.replace(`/hub/radar/empresas/${selectedClientId}?${q}`);
  }, [selectedClientId, companyId, engagementId, router]);

  const load = useCallback(async () => {
    if (selectedClientId) return;
    setLoading(true);
    setErr(null);
    try {
      const base = new URLSearchParams({ companyId });
      if (engagementId) base.set('engagementId', engagementId);

      const propsQuery = new URLSearchParams(base);
      if (isAll) propsQuery.set('all', '1');

      const aq = new URLSearchParams(base);
      aq.set('clientId', scope);

      const [propsRes, alertsRes] = await Promise.all([
        fetch(`/api/radar/properties?${propsQuery}`, { cache: 'no-store' }),
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
  }, [companyId, engagementId, isAll, scope, selectedClientId]);

  useEffect(() => {
    void load();
  }, [load, listRevision]);

  const companyQ = useMemo(() => {
    const q = new URLSearchParams({ company: companyId });
    if (engagementId) q.set('engagement', engagementId);
    return q;
  }, [companyId, engagementId]);

  const hrefFor = (p: PropRow) => {
    const q = new URLSearchParams(companyQ);
    q.set('client', p.clientId || RADAR_SCOPE_OWN);
    return `/hub/radar/properties/${p.id}?${q}`;
  };

  const urgent = useMemo(
    () => alerts.filter((a) => a.severity === 'critical' || a.severity === 'warning'),
    [alerts],
  );

  const criticalCount = useMemo(
    () => urgent.filter((a) => a.severity === 'critical').length,
    [urgent],
  );

  const portfolioClients: ClientRow[] = useMemo(() => {
    if (!isAll) return [];
    return clientsFromCtx.map((c) => ({
      id: c.id,
      name: c.name,
      propertyCount: c.propertyCount,
      contactName: c.contactName,
    }));
  }, [isAll, clientsFromCtx]);

  const unitTotal = useMemo(
    () => properties.reduce((n, p) => n + (p.unitCount || 0), 0),
    [properties],
  );

  if (selectedClientId || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (err) {
    return (
      <p className="rounded-xl border border-rose-400/40 bg-rose-950/80 px-3 py-2 text-sm text-rose-100">{err}</p>
    );
  }

  const emptyOwn = isOwn && properties.length === 0;
  const emptyPortfolio = isAll && portfolioClients.length === 0 && properties.length === 0;

  if (emptyOwn || emptyPortfolio) {
    return (
      <div className="relative mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(16,185,129,0.18),transparent_55%)]"
        />
        <MapPinned className="relative h-10 w-10 text-emerald-300" strokeWidth={1.5} />
        <h1 className="relative mt-6 font-[family-name:var(--font-etholys-display)] text-4xl tracking-tight text-white">
          {emptyPortfolio
            ? radarT(loc, 'Carteira vazia', 'Cartera vacía', 'Empty portfolio')
            : radarT(loc, 'Começa a operação', 'Empezá la operación', 'Start the operation')}
        </h1>
        <p className="relative mt-3 max-w-md text-sm leading-relaxed text-white/55">
          {emptyPortfolio
            ? radarT(
                loc,
                'Adiciona um cliente ou um espaço próprio para ver o que precisa de atenção.',
                'Agregá un cliente o un espacio propio para ver qué necesita atención.',
                'Add a client or your own space to see what needs attention.',
              )
            : radarT(
                loc,
                'Cria o primeiro lugar — fazenda, planta ou curral — e o mapa fica pronto.',
                'Creá el primer lugar — finca, planta o corral — y el mapa queda listo.',
                'Create the first place — farm, plant or yard — and the map is ready.',
              )}
        </p>
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-2">
          {emptyPortfolio && (
            <button
              type="button"
              onClick={() => setCreateOpen?.('client')}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-[#04110c]"
            >
              <Plus className="h-4 w-4" />
              {radarT(loc, 'Novo cliente', 'Nuevo cliente', 'New client')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen?.('property')}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold',
              emptyPortfolio
                ? 'border border-white/20 text-white/90 hover:bg-white/5'
                : 'bg-emerald-500 text-[#04110c]',
            )}
          >
            <Plus className="h-4 w-4" />
            {radarT(loc, 'Novo espaço', 'Nuevo espacio', 'New space')}
          </button>
        </div>
      </div>
    );
  }

  const title = isAll
    ? radarT(loc, 'Carteira', 'Cartera', 'Portfolio')
    : radarT(loc, 'A tua operação', 'Tu operación', 'Your operation');

  const metaLine = isAll
    ? [
        `${portfolioClients.length} ${radarT(loc, 'clientes', 'clientes', 'clients')}`,
        `${properties.length} ${radarT(loc, 'lugares', 'lugares', 'places')}`,
        urgent.length
          ? `${urgent.length} ${radarT(loc, 'avisos', 'avisos', 'notices')}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : [
        `${properties.length} ${radarT(loc, 'lugares', 'lugares', 'places')}`,
        `${unitTotal} ${radarT(loc, 'unidades', 'unidades', 'units')}`,
        urgent.length
          ? `${urgent.length} ${radarT(loc, 'avisos', 'avisos', 'notices')}`
          : radarT(loc, 'sem urgências', 'sin urgencias', 'no urgencies'),
      ].join(' · ');

  const topAlert = urgent[0] || null;

  return (
    <div className="relative space-y-8 pb-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-8 -top-10 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
      />

      {/* Hero — one job: status + next action */}
      <header className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300/80">RADAR</p>
          <h1 className="mt-1 font-[family-name:var(--font-etholys-display)] text-3xl tracking-tight text-white md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-white/50">{metaLine}</p>
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
                <span className="block truncate text-[11px] text-amber-100/55">
                  {[topAlert.clientName, topAlert.propertyName].filter(Boolean).join(' · ') ||
                    radarT(loc, 'Abrir aviso', 'Abrir aviso', 'Open notice')}
                </span>
              </span>
            </Link>
          ) : (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-200/90">
              <CheckCircle2 className="h-4 w-4" />
              {radarT(loc, 'Operação em ordem neste âmbito.', 'Operación en orden en este ámbito.', 'Operation looks clear in this scope.')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen?.(isAll ? 'client' : 'property')}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c] shadow-[0_0_24px_-6px_rgba(16,185,129,0.55)] transition hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" />
          {isAll
            ? radarT(loc, 'Novo cliente', 'Nuevo cliente', 'New client')
            : radarT(loc, 'Novo espaço', 'Nuevo espacio', 'New space')}
        </button>
      </header>

      {/* Composition: places + attention */}
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.85fr)] lg:items-start">
        <div className="space-y-8">
          {isAll && portfolioClients.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">
                  {radarT(loc, 'Empresas', 'Empresas', 'Companies')}
                </h2>
                <span className="text-xs tabular-nums text-white/40">{portfolioClients.length}</span>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {portfolioClients.map((c) => (
                  <li key={c.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => setScope?.(c.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-left transition hover:border-emerald-400/30 hover:bg-emerald-500/[0.06]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-emerald-300">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{c.name}</span>
                        <span className="block text-xs text-white/40">
                          {c.propertyCount} {radarT(loc, 'lugar(es)', 'lugar(es)', 'place(s)')}
                          {c.contactName ? ` · ${c.contactName}` : ''}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:text-emerald-300" />
                    </button>
                    <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                      <RadarEntityActions
                        kind="client"
                        id={c.id}
                        name={c.name}
                        companyId={companyId}
                        engagementId={engagementId}
                        locale={loc}
                        onDone={() => void afterEntityChange()}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">
                {isAll
                  ? radarT(loc, 'Lugares', 'Lugares', 'Places')
                  : radarT(loc, 'Onde trabalhar', 'Dónde trabajar', 'Where to work')}
              </h2>
              {!isAll && (
                <button
                  type="button"
                  onClick={() => setCreateOpen?.('property')}
                  className="text-xs font-medium text-emerald-300/90 hover:text-emerald-200"
                >
                  + {radarT(loc, 'Novo', 'Nuevo', 'New')}
                </button>
              )}
            </div>
            {properties.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-white/40">
                {radarT(loc, 'Ainda sem lugares neste âmbito.', 'Aún sin lugares en este ámbito.', 'No places in this scope yet.')}
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {properties.map((p) => {
                  const kind = spaceKindMeta(p.moduleId);
                  const placeAlerts = urgent.filter((a) => a.propertyId === p.id);
                  const worst = placeAlerts.find((a) => a.severity === 'critical') || placeAlerts[0];
                  return (
                    <li key={p.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => router.push(hrefFor(p))}
                        className="flex h-full w-full flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent p-4 text-left transition hover:border-emerald-400/35 hover:from-emerald-500/[0.08]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate text-[15px] font-semibold text-white">{p.name}</span>
                            <span className="mt-0.5 block truncate text-xs text-white/40">
                              {[
                                isAll ? p.clientName : null,
                                kind.unitLabelPlural[loc],
                                p.crop,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          {worst ? (
                            <span
                              className={cn(
                                'mt-1 h-2 w-2 shrink-0 rounded-full',
                                worst.severity === 'critical' ? 'bg-rose-400' : 'bg-amber-400',
                              )}
                              title={worst.message[loc]}
                            />
                          ) : (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400/50" />
                          )}
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
                        {typeof p.progressPercent === 'number' && p.progressPercent < 100 ? (
                          <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-emerald-400/70"
                              style={{ width: `${Math.max(8, Math.min(100, p.progressPercent))}%` }}
                            />
                          </div>
                        ) : null}
                      </button>
                      <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
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

        {/* Attention rail — single place for alerts */}
        <aside className="lg:sticky lg:top-4">
          <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a1620]/90">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  {radarT(loc, 'Agora', 'Ahora', 'Now')}
                </h2>
                <p className="text-[11px] text-white/40">
                  {criticalCount > 0
                    ? `${criticalCount} ${radarT(loc, 'críticos', 'críticos', 'critical')}`
                    : urgent.length > 0
                      ? `${urgent.length} ${radarT(loc, 'avisos', 'avisos', 'notices')}`
                      : radarT(loc, 'Tudo calmo', 'Todo calmo', 'All quiet')}
                </p>
              </div>
              {urgent.length > 0 && (
                <Link
                  href={`/hub/radar/tarefas?${companyQ}&client=${scope}`}
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
                  {radarT(
                    loc,
                    'Nada urgente. Abre um lugar para trabalhar.',
                    'Nada urgente. Abrí un lugar para trabajar.',
                    'Nothing urgent. Open a place to work.',
                  )}
                </p>
              </div>
            ) : (
              <ul>
                {urgent.slice(0, 6).map((a, i) => (
                  <li key={a.id} className={cn(i > 0 && 'border-t border-white/[0.06]')}>
                    <Link
                      href={a.href}
                      className="flex gap-3 px-4 py-3.5 transition hover:bg-white/[0.04]"
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                          a.severity === 'critical' ? 'bg-rose-400' : 'bg-amber-400',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug text-white/90">{a.message[loc]}</span>
                        <span className="mt-1 block truncate text-[11px] text-white/35">
                          {[a.clientName, a.propertyName].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {urgent.length > 6 && (
              <Link
                href={`/hub/radar/tarefas?${companyQ}&client=${scope}`}
                className="block border-t border-white/[0.06] px-4 py-2.5 text-center text-xs font-medium text-emerald-300 hover:bg-white/[0.03]"
              >
                +{urgent.length - 6} {radarT(loc, 'mais', 'más', 'more')}
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
