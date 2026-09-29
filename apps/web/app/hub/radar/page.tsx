'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { RadarPersonaGate } from '@/components/radar/RadarPersonaGate';
import type { RadarOrgRole } from '@/lib/radar/org-role';

function RadarHomeInner() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const router = useRouter();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = search.get('company') || activeCompanyId || '';
  const engagementId = search.get('engagement');

  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<RadarOrgRole | null>(null);

  const qs = () => {
    const q = new URLSearchParams();
    if (companyId) q.set('company', companyId);
    if (engagementId) q.set('engagement', engagementId);
    const s = q.toString();
    return s ? `?${s}` : '';
  };

  const check = useCallback(async () => {
    if (!companyId) {
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/org-role?${q}`);
      const d = await r.json();
      if (r.ok && d.radarOrgRole && d.homePath) {
        setRole(d.radarOrgRole);
        router.replace(`${d.homePath}${qs()}`);
        return;
      }
      setRole(null);
    } catch {
      setRole(null);
    } finally {
      setChecking(false);
    }
  }, [companyId, engagementId, router]);

  useEffect(() => {
    void check();
  }, [check]);

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (!companyId) {
    return (
      <p className="text-sm text-white/60">
        {loc === 'es' ? 'Elegí una empresa.' : loc === 'en' ? 'Pick a company.' : 'Escolhe uma empresa.'}
      </p>
    );
  }

  if (!role) {
    return (
      <RadarPersonaGate
        companyId={companyId}
        engagementId={engagementId}
        locale={loc}
        onChosen={(_r, homePath) => router.replace(`${homePath}${qs()}`)}
      />
    );
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
    </div>
  );
}

export default function RadarPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-emerald-300" />}>
      <RadarHomeInner />
    </Suspense>
  );
}
