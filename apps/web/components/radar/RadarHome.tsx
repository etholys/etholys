'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, MapPinned, Plus, Users } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RadarAlertsDashboard } from '@/components/radar/RadarAlertsDashboard';
import { RadarTechniciansPanel } from '@/components/radar/RadarTechniciansPanel';
import { RADAR_SCOPE_ALL, RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';
import type { PropertyStepState } from '@/lib/radar/property-progress';

type Loc = 'pt' | 'es' | 'en';

type ClientRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  propertyCount: number;
  linkedCompanyName?: string | null;
};

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

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [properties, setProperties] = useState<PropRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const base = new URLSearchParams({ companyId });
      if (engagementId) base.set('engagementId', engagementId);

      const clientsRes = await fetch(`/api/radar/clients?${base}`, { cache: 'no-store' });
      const clientsData = await clientsRes.json();
      if (!clientsRes.ok) throw new Error(clientsData.error || 'Falha');
      setClients(clientsData.clients || []);

      const pq = new URLSearchParams(base);
      if (isAll) pq.set('all', '1');
      else if (isOwn) {
        /* clientId null = own */
      } else if (selectedClientId) pq.set('clientId', selectedClientId);
      else pq.set('all', '1');

      const propsRes = await fetch(`/api/radar/properties?${pq}`, { cache: 'no-store' });
      const propsData = await propsRes.json();
      if (!propsRes.ok) throw new Error(propsData.error || 'Falha');
      setProperties(propsData.properties || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, isAll, isOwn, selectedClientId]);

  useEffect(() => {
    void load();
  }, [load, listRevision]);

  const companyQ = engagementId
    ? `company=${companyId}&engagement=${engagementId}`
    : `company=${companyId}`;

  const scopeLabel = isOwn
    ? loc === 'es'
      ? 'Mi operación'
      : loc === 'en'
        ? 'My operation'
        : 'Minha operação'
    : isAll
      ? loc === 'es'
        ? 'Todos'
        : 'Todos'
      : clients.find((c) => c.id === selectedClientId)?.name || '…';

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">RADAR</p>
          <h1 className="mt-2 font-serif text-4xl text-white">
            {loc === 'es' ? 'Central operativa' : loc === 'en' ? 'Ops home' : 'Central operativa'}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/55">
            {loc === 'es'
              ? `Ámbito: ${scopeLabel}. Propiedades, clientes, técnicos y alertas.`
              : loc === 'en'
                ? `Scope: ${scopeLabel}. Properties, clients, technicians and alerts.`
                : `Âmbito: ${scopeLabel}. Propriedades, clientes, técnicos e alertas.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen?.('property')}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c]"
          >
            <MapPinned className="h-4 w-4" />
            {loc === 'en' ? 'New farm' : 'Nova fazenda'}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen?.('client')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white/85"
          >
            <Plus className="h-4 w-4" />
            {loc === 'en' ? 'New client' : 'Novo cliente'}
          </button>
        </div>
      </div>

      {err && <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{err}</p>}

      <RadarAlertsDashboard companyId={companyId} engagementId={engagementId} locale={locale} />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                {isOwn
                  ? loc === 'en'
                    ? 'My properties'
                    : 'Minhas propriedades'
                  : loc === 'en'
                    ? 'Properties'
                    : 'Propriedades'}
              </h2>
            </div>
            {properties.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-white/15 px-5 py-8 text-center">
                <p className="text-sm text-white/55">
                  {isOwn
                    ? loc === 'en'
                      ? 'No farm yet — register your property and start the plant map.'
                      : 'Ainda sem fazenda — cadastra a tua propriedade e começa a planta.'
                    : loc === 'en'
                      ? 'No properties in this scope.'
                      : 'Sem propriedades neste âmbito.'}
                </p>
                <button
                  type="button"
                  onClick={() => setCreateOpen?.('property')}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c]"
                >
                  <MapPinned className="h-4 w-4" />
                  {loc === 'en' ? 'Register farm' : 'Cadastrar fazenda'}
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {properties.map((p) => (
                  <Link
                    key={p.id}
                    href={`/hub/radar/properties/${p.id}?${companyQ}&client=${p.clientId || RADAR_SCOPE_OWN}`}
                    className="group rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 transition hover:border-emerald-400/35"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-white">{p.name}</p>
                        <p className="mt-0.5 text-xs text-white/45">
                          {[p.clientName || (loc === 'en' ? 'Own' : 'Própria'), p.crop, p.moduleId]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-emerald-300" />
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/30">
                      <div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${p.progressPercent}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-white/40">{p.progressPercent}%</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {(isAll || !isOwn) && (
            <section className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                {loc === 'en' ? 'Clients' : 'Clientes'}
              </h2>
              {clients.length === 0 ? (
                <p className="text-sm text-white/45">
                  {loc === 'en'
                    ? 'Optional — only if you assist other farms.'
                    : 'Opcional — só se assistes outras fazendas.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {clients
                    .filter((c) => isAll || c.id === selectedClientId)
                    .map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-emerald-300/70" />
                          <div>
                            <p className="text-sm font-medium text-white">{c.name}</p>
                            <p className="text-[11px] text-white/40">
                              {c.linkedCompanyName ? `AURORA · ${c.linkedCompanyName}` : c.contactName || '—'}
                              {' · '}
                              {c.propertyCount} {loc === 'en' ? 'farms' : 'fazendas'}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          )}

          <RadarTechniciansPanel companyId={companyId} engagementId={engagementId} locale={locale} />
        </>
      )}
    </div>
  );
}
