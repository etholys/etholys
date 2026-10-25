'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  ChevronRight,
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

/** Ops dashboard — where am I, what needs attention, how to open a place. */
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

  // Client scope on home → company dashboard
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

      // own: omit clientId → API returns properties with clientId null
      // all: all=1 → full portfolio
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

  const portfolioClients: ClientRow[] = useMemo(() => {
    if (!isAll) return [];
    return clientsFromCtx.map((c) => ({
      id: c.id,
      name: c.name,
      propertyCount: c.propertyCount,
      contactName: c.contactName,
    }));
  }, [isAll, clientsFromCtx]);

  if (selectedClientId) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    );
  }

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

  const emptyOwn = isOwn && properties.length === 0;
  const emptyPortfolio = isAll && portfolioClients.length === 0 && properties.length === 0;

  if (emptyOwn || emptyPortfolio) {
    return (
      <div className="mx-auto max-w-lg px-2 py-14 text-center">
        <MapPinned className="mx-auto h-9 w-9 text-emerald-300" />
        <h1 className="mt-5 font-serif text-3xl text-white">
          {emptyPortfolio
            ? radarT(loc, 'Carteira vazia', 'Cartera vacía', 'Empty portfolio')
            : radarT(loc, 'Começa a operação', 'Empezá la operación', 'Start the operation')}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {emptyPortfolio
            ? radarT(
                loc,
                'Adiciona um cliente ou um espaço próprio para ver alertas e lugares aqui.',
                'Agregá un cliente o un espacio propio para ver alertas y lugares aquí.',
                'Add a client or your own space to see alerts and places here.',
              )
            : radarT(
                loc,
                'Cria o primeiro lugar — fazenda, planta ou curral — e o mapa 3D + Caderno ficam prontos.',
                'Creá el primer lugar — finca, planta o corral — y el mapa 3D + Cuaderno quedan listos.',
                'Create the first place — farm, plant or yard — then 3D map + Notebook are ready.',
              )}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {emptyPortfolio && (
            <button
              type="button"
              onClick={() => setCreateOpen?.('client')}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#04110c]"
            >
              <Plus className="h-4 w-4" />
              {radarT(loc, 'Novo cliente', 'Nuevo cliente', 'New client')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen?.('property')}
            className={
              emptyPortfolio
                ? 'inline-flex items-center gap-2 rounded-xl border border-emerald-400/45 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-100'
                : 'inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#04110c]'
            }
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
  const subtitle = isAll
    ? radarT(
        loc,
        'Resumo da carteira — entra numa empresa para ver os seus lugares.',
        'Resumen de la cartera — entrá a una empresa para ver sus lugares.',
        'Portfolio summary — open a company to see its places.',
      )
    : radarT(
        loc,
        'O que precisa de atenção e onde trabalhar agora.',
        'Qué necesita atención y dónde trabajar ahora.',
        'What needs attention and where to work now.',
      );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-white md:text-4xl">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-300">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen?.(isAll ? 'client' : 'property')}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c]"
        >
          <Plus className="h-4 w-4" />
          {isAll
            ? radarT(loc, 'Novo cliente', 'Nuevo cliente', 'New client')
            : radarT(loc, 'Novo espaço', 'Nuevo espacio', 'New space')}
        </button>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-white/15 bg-slate-950 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isAll
              ? radarT(loc, 'Clientes', 'Clientes', 'Clients')
              : radarT(loc, 'Lugares', 'Lugares', 'Places')}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {isAll ? portfolioClients.length : properties.length}
          </p>
        </div>
        <div className="rounded-xl border border-white/15 bg-slate-950 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isAll
              ? radarT(loc, 'Espaços', 'Espacios', 'Spaces')
              : radarT(loc, 'Unidades', 'Unidades', 'Units')}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {isAll
              ? properties.length
              : properties.reduce((n, p) => n + (p.unitCount || 0), 0)}
          </p>
        </div>
        <Link
          href={`/hub/radar/tarefas?${companyQ}&client=${scope}`}
          className="col-span-2 rounded-xl border border-amber-400/35 bg-amber-950 px-4 py-3 sm:col-span-1"
        >
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">
            <Bell className="h-3 w-3" />
            {radarT(loc, 'Avisos', 'Avisos', 'Notices')}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-50">{urgent.length}</p>
        </Link>
      </div>

      {/* Needs attention — once, not on every card */}
      <section className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">
            {radarT(loc, 'Precisa atenção', 'Necesita atención', 'Needs attention')}
          </h2>
          {urgent.length > 0 && (
            <Link
              href={`/hub/radar/tarefas?${companyQ}&client=${scope}`}
              className="text-xs text-emerald-200 hover:text-emerald-100"
            >
              {radarT(loc, 'Ver todas', 'Ver todas', 'See all')}
            </Link>
          )}
        </div>
        {urgent.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-400">
            {radarT(
              loc,
              'Nada urgente neste âmbito.',
              'Nada urgente en este ámbito.',
              'Nothing urgent in this scope.',
            )}
          </p>
        ) : (
          <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/15 bg-slate-950">
            {urgent.slice(0, 5).map((a) => (
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
                    <span className="mt-0.5 block truncate text-xs text-slate-400">
                      {[a.clientName, a.propertyName].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Portfolio companies */}
      {isAll && portfolioClients.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-white">
            {radarT(loc, 'Empresas / clientes', 'Empresas / clientes', 'Companies / clients')}
          </h2>
          <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/15 bg-slate-950">
            {portfolioClients.map((c) => (
              <li key={c.id}>
                <div className="flex items-center gap-2 px-2 py-1.5 sm:px-3">
                  <button
                    type="button"
                    onClick={() => setScope?.(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left transition hover:bg-white/5 rounded-lg"
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{c.name}</span>
                      <span className="block text-xs text-slate-400">
                        {c.propertyCount}{' '}
                        {radarT(loc, 'lugar(es)', 'lugar(es)', 'place(s)')}
                        {c.contactName ? ` · ${c.contactName}` : ''}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
                  </button>
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

      {/* Compact places */}
      <section className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">
            {isAll
              ? radarT(loc, 'Lugares (carteira)', 'Lugares (cartera)', 'Places (portfolio)')
              : radarT(loc, 'Lugares', 'Lugares', 'Places')}
          </h2>
          {!isAll && (
            <button
              type="button"
              onClick={() => setCreateOpen?.('property')}
              className="text-xs text-emerald-200 hover:text-emerald-100"
            >
              + {radarT(loc, 'Novo', 'Nuevo', 'New')}
            </button>
          )}
        </div>
        {properties.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 bg-slate-950 px-4 py-6 text-center text-sm text-slate-400">
            {radarT(loc, 'Ainda sem lugares neste âmbito.', 'Aún sin lugares en este ámbito.', 'No places in this scope yet.')}
          </p>
        ) : (
          <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/15 bg-slate-950">
            {properties.map((p) => {
              const kind = spaceKindMeta(p.moduleId);
              const hasAlert = urgent.some((a) => a.propertyId === p.id);
              return (
                <li key={p.id}>
                  <div className="flex items-center gap-2 px-2 py-1 sm:px-3">
                    <button
                      type="button"
                      onClick={() => router.push(hrefFor(p))}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-white">{p.name}</span>
                          {hasAlert && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="aviso" />
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-400">
                          {[
                            isAll ? p.clientName : null,
                            kind.unitLabelPlural[loc],
                            p.crop,
                            p.unitCount
                              ? `${p.unitCount} ${radarT(loc, 'unid.', 'unid.', 'units')}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100">
                        {radarT(loc, 'Abrir', 'Abrir', 'Open')}
                      </span>
                    </button>
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
