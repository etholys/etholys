'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { RadarCompanyDashboard } from '@/components/radar/RadarCompanyDashboard';

function CompanyInner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const params = useParams();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');
  const clientId = String(params.id || '');

  if (!companyId || !clientId) {
    return (
      <p className="text-sm text-slate-300">
        {loc === 'es' ? 'Elegí una empresa.' : loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.'}
      </p>
    );
  }

  return (
    <RadarCompanyDashboard
      companyId={companyId}
      engagementId={engagementId}
      clientId={clientId}
      locale={loc}
    />
  );
}

export default function RadarEmpresaPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-emerald-300" />}>
      <CompanyInner />
    </Suspense>
  );
}
