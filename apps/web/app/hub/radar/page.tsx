'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { RadarAgricultureBoard } from '@/components/radar/RadarAgricultureBoard';
import { RADAR_MODULES } from '@/lib/etholys-products';

function RadarInner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');
  const [moduleId, setModuleId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/radar/bridge?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.radarModule || d?.pulsoModule) setModuleId(d.radarModule || d.pulsoModule);
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

  const waiting =
    loc === 'es'
      ? 'Mismo lazo que agricultura: unidad, lectura, alerta, WhatsApp. Aún no está cerrado.'
      : loc === 'en'
        ? 'Same loop as agriculture: unit, reading, alert, WhatsApp. Not closed yet.'
        : 'O mesmo laço da agricultura: unidade, leitura, alerta, WhatsApp. Ainda não está fechado.';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {RADAR_MODULES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => void pick(m.id)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              moduleId === m.id ? 'border-violet-400/50 bg-violet-500/20 text-white' : 'border-white/15 text-white/55 hover:text-white'
            }`}
          >
            {m[loc]}
          </button>
        ))}
      </div>

      {!moduleId && (
        <header>
          <h1 className="font-serif text-3xl text-white">
            {loc === 'es' ? 'Qué está pasando en la finca, ahora' : loc === 'en' ? 'What is happening on the farm, now' : 'O que está a acontecer na exploração, agora'}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/60">
            {loc === 'es'
              ? 'Elige el módulo. Agricultura ya lee humedad, riego, carencia y WhatsApp.'
              : loc === 'en'
                ? 'Pick the module. Agriculture already reads moisture, irrigation, PHI and WhatsApp.'
                : 'Escolhe o módulo. Agricultura já lê humidade, irrigação, carência e WhatsApp.'}
          </p>
        </header>
      )}

      {moduleId === 'agriculture' && (
        <RadarAgricultureBoard companyId={companyId} engagementId={engagementId} locale={loc} />
      )}
      {moduleId && moduleId !== 'agriculture' && (
        <p className="max-w-xl text-sm text-white/60">{waiting}</p>
      )}
    </div>
  );
}

export default function RadarPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-violet-300" />}>
      <RadarInner />
    </Suspense>
  );
}
