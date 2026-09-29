'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, MapPinned, Plus, Users } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RadarAlertsDashboard } from '@/components/radar/RadarAlertsDashboard';
import { RADAR_CLIENT_ALL } from '@/lib/radar/client-scope';
import type { PropertyStepState } from '@/lib/radar/property-progress';

type Loc = 'pt' | 'es' | 'en';

type ClientRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  propertyCount: number;
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

export function RadarProviderHome({
  companyId,
  engagementId,
  locale,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const router = useRouter();
  const scope = useRadarClientScopeOptional();
  const clientScope = scope?.clientScope || RADAR_CLIENT_ALL;
  const selectedClientId = clientScope === RADAR_CLIENT_ALL ? null : clientScope;
  const setCreateOpen = scope?.setCreateOpen;
  const setClientScope = scope?.setClientScope;

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

      const clientsRes = await fetch(`/api/radar/clients?${base}`);
      const clientsData = await clientsRes.json();
      if (!clientsRes.ok) throw new Error(clientsData.error || 'Falha');
      setClients(clientsData.clients || []);

      const pq = new URLSearchParams(base);
      if (selectedClientId) pq.set('clientId', selectedClientId);
      else pq.set('all', '1');
      const propsRes = await fetch(`/api/radar/properties?${pq}`);
      const propsData = await propsRes.json();
      if (!propsRes.ok) throw new Error(propsData.error || 'Falha');
      setProperties(propsData.properties || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, selectedClientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const companyQ = engagementId
    ? `company=${companyId}&engagement=${engagementId}`
    : `company=${companyId}`;

  const scopeLabel =
    selectedClientId
      ? clients.find((c) => c.id === selectedClientId)?.name || scope?.selectedClient?.name || '…'
      : loc === 'es'
        ? 'Todos los clientes'
        : loc === 'en'
          ? 'All clients'
          : 'Todos os clientes';

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
            RADAR · Prestadora
          </p>
          <h1 className="mt-2 font-serif text-4xl text-white">
            {loc === 'es' ? 'Central operativa' : loc === 'en' ? 'Ops home' : 'Central operativa'}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/55">
            {loc === 'es'
              ? `Ámbito: ${scopeLabel}. Alertas globales, clientes y fincas.`
              : loc === 'en'
                ? `Scope: ${scopeLabel}. Global alerts, clients and farms.`
                : `Âmbito: ${scopeLabel}. Alertas globais, clientes e fazendas.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen?.('client')}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#04110c]"
          >
            <Plus className="h-4 w-4" />
            {loc === 'en' ? 'Register client' : 'Cadastrar cliente'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedClientId) {
                setCreateOpen?.('client');
                return;
              }
              setCreateOpen?.('property');
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100"
          >
            <MapPinned className="h-4 w-4" />
            {loc === 'en' ? 'Register farm' : 'Cadastrar fazenda'}
          </button>
        </div>
      </div>

      <RadarAlertsDashboard companyId={companyId} engagementId={engagementId} locale={loc} />

      {err && <p className="text-sm text-rose-200">{err}</p>}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
        </div>
      ) : (
        <>
          {!selectedClientId && (
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <h2 className="font-serif text-2xl text-white">
                  {loc === 'es' ? 'Clientes' : loc === 'en' ? 'Clients' : 'Clientes'}
                </h2>
              </div>
              {clients.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 px-8 py-12 text-center">
                  <Users className="mx-auto h-8 w-8 text-white/30" />
                  <p className="mt-4 font-serif text-2xl text-white">
                    {loc === 'es' ? 'Sin clientes aún' : loc === 'en' ? 'No clients yet' : 'Ainda sem clientes'}
                  </p>
                  <p className="mt-2 text-sm text-white/50">
                    {loc === 'es'
                      ? 'Registrá el primero — después una finca y el embudo completo.'
                      : 'Regista o primeiro — depois uma fazenda e o funil completo.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCreateOpen?.('client')}
                    className="mt-6 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#04110c]"
                  >
                    {loc === 'en' ? 'Register client' : 'Cadastrar cliente'}
                  </button>
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {clients.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setClientScope?.(c.id);
                          router.push(
                            `/hub/radar/provider/clients/${c.id}?${companyQ}&client=${c.id}`,
                          );
                        }}
                        className="group flex w-full items-center justify-between rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-5 py-5 text-left transition hover:border-emerald-400/35 hover:bg-emerald-500/10"
                      >
                        <div>
                          <p className="text-lg font-medium text-white">{c.name}</p>
                          <p className="mt-1 text-xs text-white/45">
                            {c.propertyCount}{' '}
                            {loc === 'en'
                              ? 'properties'
                              : c.propertyCount === 1
                                ? 'propriedade'
                                : 'propriedades'}
                            {c.contactName ? ` · ${c.contactName}` : ''}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-white/30 transition group-hover:text-emerald-200" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-serif text-2xl text-white">
                {selectedClientId
                  ? loc === 'es'
                    ? 'Propiedades del cliente'
                    : loc === 'en'
                      ? 'Client properties'
                      : 'Propriedades do cliente'
                  : loc === 'es'
                    ? 'Propiedades (cartera)'
                    : loc === 'en'
                      ? 'Properties (portfolio)'
                      : 'Propriedades (carteira)'}
              </h2>
              {selectedClientId && (
                <button
                  type="button"
                  onClick={() => setCreateOpen?.('property')}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-200 hover:text-emerald-100"
                >
                  <Plus className="h-4 w-4" />
                  {loc === 'en' ? 'New farm' : 'Nova fazenda'}
                </button>
              )}
            </div>

            {properties.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 px-8 py-12 text-center">
                <MapPinned className="mx-auto h-8 w-8 text-white/30" />
                <p className="mt-4 font-serif text-2xl text-white">
                  {loc === 'es' ? 'Sin fincas aquí' : loc === 'en' ? 'No farms here' : 'Sem fazendas aqui'}
                </p>
                <p className="mt-2 text-sm text-white/50">
                  {selectedClientId
                    ? loc === 'es'
                      ? 'Creá la primera para caracterizar → planta → geo → sensores.'
                      : 'Cria a primeira para caracterizar → planta → geo → sensores.'
                    : loc === 'es'
                      ? 'Elegí un cliente o registrá uno nuevo, luego la finca.'
                      : 'Escolhe um cliente ou cadastra um novo, depois a fazenda.'}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setCreateOpen?.(selectedClientId ? 'property' : 'client')
                  }
                  className="mt-6 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#04110c]"
                >
                  {selectedClientId
                    ? loc === 'en'
                      ? 'Register farm'
                      : 'Cadastrar fazenda'
                    : loc === 'en'
                      ? 'Register client'
                      : 'Cadastrar cliente'}
                </button>
              </div>
            ) : (
              <ul className="grid gap-3">
                {properties.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/hub/radar/properties/${p.id}?${companyQ}${p.clientId ? `&client=${p.clientId}` : ''}`}
                      className="group flex items-center justify-between gap-4 rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-5 py-5 transition hover:border-emerald-400/35 hover:bg-emerald-500/10"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-lg font-medium text-white">{p.name}</p>
                        <p className="mt-1 text-xs text-white/45">
                          {!selectedClientId && p.clientName ? `${p.clientName} · ` : ''}
                          {p.crop || p.moduleId || (loc === 'en' ? 'Not characterized' : 'Por caracterizar')}
                          {' · '}
                          {p.progressPercent}%
                        </p>
                        <div className="mt-3 h-1 w-40 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full bg-emerald-400" style={{ width: `${p.progressPercent}%` }} />
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-white/30 group-hover:text-emerald-200" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
