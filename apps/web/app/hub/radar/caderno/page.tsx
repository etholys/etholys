'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { RadarCadernoBoard } from '@/components/radar/RadarCadernoBoard';

function Inner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');
  const propertyId = search.get('property') || search.get('propertyId');
  const unitId = search.get('unit') || search.get('unitId');

  if (!companyId) {
    return (
      <p className="text-sm text-white/60">
        {loc === 'es' ? 'Elegí una empresa.' : loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.'}
      </p>
    );
  }

  return (
    <RadarCadernoBoard
      companyId={companyId}
      engagementId={engagementId}
      locale={loc}
      initialPropertyId={propertyId}
      initialUnitId={unitId}
    />
  );
}

export default function RadarCadernoPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-teal-300" />}>
      <Inner />
    </Suspense>
  );
}
