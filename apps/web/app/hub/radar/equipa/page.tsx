'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Plus, Users } from 'lucide-react';
import { useApp } from '@/app/providers';
import { RadarTechniciansPanel } from '@/components/radar/RadarTechniciansPanel';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';

function Inner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const router = useRouter();
  const scopeCtx = useRadarClientScopeOptional();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');

  if (!companyId) {
    return (
      <p className="text-sm text-white/60">
        {loc === 'es' ? 'Elegí una empresa.' : loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.'}
      </p>
    );
  }

  const openClient = (clientId: string) => {
    scopeCtx?.setScope(clientId);
    const q = new URLSearchParams();
    q.set('company', companyId);
    if (engagementId) q.set('engagement', engagementId);
    q.set('client', clientId);
    router.push(`/hub/radar?${q}`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">RADAR</p>
          <h1 className="mt-2 font-serif text-4xl text-white">
            {loc === 'es' ? 'Equipo' : loc === 'en' ? 'Team' : 'Equipa'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => scopeCtx?.setCreateOpen?.('client')}
          className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white/85"
        >
          <Plus className="h-4 w-4" />
          {loc === 'en' ? 'New client' : 'Novo cliente'}
        </button>
      </div>

      <RadarTechniciansPanel companyId={companyId} engagementId={engagementId} locale={loc} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
            {loc === 'en' ? 'Clients' : 'Clientes'}
          </h2>
        </div>
        {(scopeCtx?.clients?.length || 0) === 0 ? (
          <p className="text-sm text-white/40">—</p>
        ) : (
          <ul className="space-y-2">
            {scopeCtx!.clients.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openClient(c.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-emerald-400/30"
                >
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-300/70" />
                    <span className="text-sm text-white">{c.name}</span>
                  </span>
                  <span className="text-[11px] text-white/40">
                    {c.propertyCount} {loc === 'en' ? 'spaces' : 'espaços'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function RadarEquipaPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-emerald-300" />}>
      <Inner />
    </Suspense>
  );
}
