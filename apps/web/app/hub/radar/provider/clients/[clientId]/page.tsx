'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';

/** Legacy path → company dashboard. */
function RedirectInner() {
  const { activeCompanyId } = useApp();
  const search = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');
  const clientId = String(params.clientId || '');

  useEffect(() => {
    if (!clientId) return;
    const q = new URLSearchParams();
    if (companyId) q.set('company', companyId);
    if (engagementId) q.set('engagement', engagementId);
    q.set('client', clientId);
    router.replace(`/hub/radar/empresas/${clientId}?${q}`);
  }, [clientId, companyId, engagementId, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
    </div>
  );
}

export default function RadarProviderClientRedirect() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-emerald-300" />}>
      <RedirectInner />
    </Suspense>
  );
}
