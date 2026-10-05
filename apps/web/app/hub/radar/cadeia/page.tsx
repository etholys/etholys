'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { RadarChainBoard } from '@/components/radar/RadarChainBoard';

function Inner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">RADAR</p>
        <h1 className="mt-2 font-serif text-4xl text-white">
          {loc === 'es' ? 'Cadena' : loc === 'en' ? 'Chain' : 'Cadeia'}
        </h1>
        <p className="mt-2 max-w-lg text-sm text-white/50">
          {loc === 'es'
            ? 'Del campo al camión — el recorrido del lote.'
            : loc === 'en'
              ? 'From field to truck — the lot journey.'
              : 'Do campo ao camião — o percurso do lote.'}
        </p>
      </div>
      <RadarChainBoard companyId={companyId} engagementId={engagementId} locale={loc} />
    </div>
  );
}

export default function RadarCadeiaPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-emerald-300" />}>
      <Inner />
    </Suspense>
  );
}
