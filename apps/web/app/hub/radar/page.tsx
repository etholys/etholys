'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { NexusOpsWorkspace } from '@/components/nexus/NexusOpsWorkspace';
import { RADAR_MODULES } from '@/lib/etholys-products';

function RadarInner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [bridge, setBridge] = useState<{ hasPortrait?: boolean; openBets?: number } | null>(null);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/radar/bridge?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setBridge(d);
          if (d.radarModule || d.pulsoModule) setModuleId(d.radarModule || d.pulsoModule);
        }
      })
      .catch(() => {});
  }, [companyId]);

  const pick = async (id: string) => {
    setModuleId(id);
    if (!companyId) return;
    await fetch('/api/business-dossier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, pulsoModule: id }),
    });
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-800">RADAR</p>
        <h1 className="mt-1 font-serif text-3xl text-slate-900">
          {loc === 'es' ? 'Digitalización productiva' : loc === 'en' ? 'Productive digitalization' : 'Digitalização produtiva'}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          {loc === 'es'
            ? 'Datos, WhatsApp, alertas y automatización. Se conecta a AURORA o POLARIS por API interna — no es la incubadora.'
            : loc === 'en'
              ? 'Data, WhatsApp, alerts and automation. Connects to AURORA or POLARIS via internal API — it is not the incubator.'
              : 'Dados, WhatsApp, alertas e automatização. Liga-se ao AURORA ou ao POLARIS por API interna — não é a incubadora.'}
        </p>
        {bridge?.hasPortrait && (
          <p className="mt-2 text-xs text-violet-900">
            {loc === 'es' ? 'Hay retrato en el mapa/incubadora' : 'Há retrato no mapa/incubadora'}
            {bridge.openBets ? ` · ${bridge.openBets} ${loc === 'es' ? 'apuestas abiertas' : 'apostas abertas'}` : ''}
          </p>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {RADAR_MODULES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => void pick(m.id)}
            className={`rounded-2xl border px-4 py-3 text-left ${
              moduleId === m.id ? 'border-violet-600 bg-violet-50' : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">{m[loc]}</p>
            <p className="mt-1 text-xs text-slate-500">{m.hint[loc]}</p>
          </button>
        ))}
      </div>

      <NexusOpsWorkspace />
    </div>
  );
}

export default function RadarPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-violet-700" />}>
      <RadarInner />
    </Suspense>
  );
}
