'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { useRadarClientScope } from '@/components/radar/RadarClientScopeContext';
import { RadarDroneMapping } from '@/components/radar/drone/RadarDroneMapping';

function Inner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const { companyId: scopeCompany, engagementId: scopeEng, scope } = useRadarClientScope();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || scopeCompany || activeCompanyId || '';
  const engagementId = search.get('engagement') || scopeEng;
  const propertyId = search.get('property') || search.get('propertyId');
  const clientId = search.get('client') || scope || null;

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (companyId) q.set('company', companyId);
    if (engagementId) q.set('engagement', engagementId);
    if (clientId) q.set('client', clientId);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [clientId, companyId, engagementId]);

  if (!companyId) {
    return (
      <p className="text-sm text-white/60">
        {loc === 'es' ? 'Elegí una empresa.' : loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.'}
      </p>
    );
  }

  return (
    <RadarDroneMapping
      companyId={companyId}
      engagementId={engagementId}
      locale={loc}
      initialPropertyId={propertyId}
      qs={qs}
    />
  );
}

export default function RadarDronePage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-teal-300" />}>
      <Inner />
    </Suspense>
  );
}
