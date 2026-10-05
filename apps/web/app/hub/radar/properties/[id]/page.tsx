'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { RadarPropertyWorkspace } from '@/components/radar/RadarPropertyWorkspace';

function PropertyInner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const params = useParams();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');
  const initialUnitId = search.get('unit');
  const propertyId = String(params.id || '');

  if (!companyId || !propertyId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    );
  }

  const backHref = `/hub/radar?company=${companyId}${engagementId ? `&engagement=${engagementId}` : ''}`;

  return (
    <RadarPropertyWorkspace
      companyId={companyId}
      propertyId={propertyId}
      engagementId={engagementId}
      locale={loc}
      backHref={backHref}
      initialUnitId={initialUnitId}
    />
  );
}

export default function RadarPropertyPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-emerald-300" />}>
      <PropertyInner />
    </Suspense>
  );
}
