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
      ? 'Este módulo abre con el mismo lazo — unidad, lectura, alerta, WhatsApp — después de agricultura.'
      : loc === 'en'
        ? 'This module opens on the same loop — unit, reading, alert, WhatsApp — after agriculture.'
        : 'Este módulo abre no mesmo laço — unidade, leitura, alerta, WhatsApp — depois da agricultura.';

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-800">RADAR</p>
        <h1 className="mt-1 font-serif text-3xl text-slate-900">
          {loc === 'es' ? 'Digitalización productiva' : loc === 'en' ? 'Productive digitalization' : 'Digitalização produtiva'}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          {loc === 'es'
            ? 'Datos, WhatsApp, alertas y automatización. Se conecta a AURORA o POLARIS por API interna.'
            : loc === 'en'
              ? 'Data, WhatsApp, alerts and automation. Connects to AURORA or POLARIS via internal API.'
              : 'Dados, WhatsApp, alertas e automatização. Liga-se ao AURORA ou ao POLARIS por API interna.'}
        </p>
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

      {moduleId === 'agriculture' && (
        <RadarAgricultureBoard companyId={companyId} engagementId={engagementId} locale={loc} />
      )}
      {moduleId && moduleId !== 'agriculture' && (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{waiting}</p>
      )}
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
