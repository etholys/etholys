'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { RadarPropertiesBoard } from '@/components/radar/RadarPropertiesBoard';
import { RadarPersonaGate } from '@/components/radar/RadarPersonaGate';

function ProducerInner() {
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
      if (d.radarOrgRole !== 'producer') {
        router.replace(`${d.homePath || '/hub/radar/provider'}?company=${companyId}${engagementId ? `&engagement=${engagementId}` : ''}`);
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
        onChosen={(_r, homePath) => {
          router.replace(`${homePath}?company=${companyId}${engagementId ? `&engagement=${engagementId}` : ''}`);
        }}
      />
    );
  }

  return (
    <RadarPropertiesBoard
      companyId={companyId}
      engagementId={engagementId}
      locale={loc}
      title={loc === 'es' ? 'Mis propiedades' : loc === 'en' ? 'My properties' : 'As minhas propriedades'}
      subtitle={
        loc === 'es'
          ? 'Caracterizar → dibujar planta → geolocalizar → conectar sensores → operación en vivo.'
          : loc === 'en'
            ? 'Characterize → draw plant → geolocate → connect sensors → live ops.'
            : 'Caracterizar → desenhar planta → geolocalizar → conectar sensores → operação ao vivo.'
      }
    />
  );
}

export default function RadarProducerPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-emerald-300" />}>
      <ProducerInner />
    </Suspense>
  );
}
