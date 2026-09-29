'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { RadarPropertiesBoard } from '@/components/radar/RadarPropertiesBoard';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RadarAlertsDashboard } from '@/components/radar/RadarAlertsDashboard';

function ClientInner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const scope = useRadarClientScopeOptional();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');
  const clientId = String(params.clientId || '');
  const [clientName, setClientName] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!companyId || !clientId) return;
    void (async () => {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/clients?${q}`);
      const d = await r.json();
      const row = (d.clients || []).find((c: { id: string }) => c.id === clientId);
      if (!row) {
        router.replace(`/hub/radar/provider?company=${companyId}`);
        return;
      }
      setClientName(row.name);
      setReady(true);
    })();
  }, [companyId, clientId, engagementId, router]);

  useEffect(() => {
    if (!clientId || !scope) return;
    if (scope.clientScope !== clientId) scope.setClientScope(clientId);
    // Intentional: sync picker once per client route
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!companyId || !ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    );
  }

  const back = `/hub/radar/provider?company=${companyId}${engagementId ? `&engagement=${engagementId}` : ''}&client=all`;

  return (
    <div className="space-y-8">
      <RadarAlertsDashboard
        companyId={companyId}
        engagementId={engagementId}
        locale={loc}
        clientId={clientId}
      />
      <RadarPropertiesBoard
        companyId={companyId}
        engagementId={engagementId}
        clientId={clientId}
        locale={loc}
        backHref={back}
        title={clientName}
        subtitle={
          loc === 'es'
            ? 'Propiedades de este cliente — caracterizar, dibujar, geolocalizar, sensores.'
            : loc === 'en'
              ? 'This client’s properties — characterize, draw, geolocate, sensors.'
              : 'Propriedades deste cliente — caracterizar, desenhar, geolocalizar, sensores.'
        }
      />
    </div>
  );
}

export default function RadarProviderClientPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-emerald-300" />}>
      <ClientInner />
    </Suspense>
  );
}
