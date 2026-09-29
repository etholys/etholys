'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { RadarClientsBoard } from '@/components/radar/RadarClientsBoard';
import { RadarPersonaGate } from '@/components/radar/RadarPersonaGate';

function ProviderInner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const router = useRouter();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');
  const [gate, setGate] = useState<'load' | 'persona' | 'ok'>('load');

  useEffect(() => {
    if (!companyId) {
      setGate('ok');
      return;
    }
    void (async () => {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/org-role?${q}`);
      const d = await r.json();
      if (!r.ok || !d.radarOrgRole) {
        setGate('persona');
        return;
      }
      if (d.radarOrgRole !== 'provider') {
        router.replace(`${d.homePath || '/hub/radar/producer'}?company=${companyId}${engagementId ? `&engagement=${engagementId}` : ''}`);
        return;
      }
      setGate('ok');
    })();
  }, [companyId, engagementId, router]);

  if (gate === 'load') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (!companyId) {
    return <p className="text-sm text-white/60">{loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.'}</p>;
  }

  if (gate === 'persona') {
    return (
      <RadarPersonaGate
        companyId={companyId}
        engagementId={engagementId}
        locale={loc}
        onChosen={(role, homePath) => {
          const q = `?company=${companyId}${engagementId ? `&engagement=${engagementId}` : ''}`;
          router.replace(`${homePath}${q}`);
        }}
      />
    );
  }

  return <RadarClientsBoard companyId={companyId} engagementId={engagementId} locale={loc} />;
}

export default function RadarProviderPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-emerald-300" />}>
      <ProviderInner />
    </Suspense>
  );
}
