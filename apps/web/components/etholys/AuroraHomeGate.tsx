'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuroraPortfolioWorkspace } from '@/components/etholys/AuroraPortfolioWorkspace';
import { useAuroraAttended } from '@/components/etholys/AuroraAttendedContext';

/** Entrada AURORA: incubadora → carteira; negócio atendido → só avance. */
export function AuroraHomeGate({
  company,
  engagement,
}: {
  company?: string;
  engagement?: string;
}) {
  const router = useRouter();
  const { isAttendedViewer, avanceHref, hasSelection, loading } = useAuroraAttended();

  useEffect(() => {
    if (loading) return;
    if (isAttendedViewer) {
      router.replace(hasSelection ? avanceHref : '/hub/aurora/avance');
      return;
    }
    const c = String(company || '').trim();
    if (c) {
      const q = new URLSearchParams({ company: c });
      const e = String(engagement || '').trim();
      if (e) q.set('engagement', e);
      router.replace(`/hub/aurora/diagnostico?${q}`);
    }
  }, [loading, isAttendedViewer, avanceHref, hasSelection, company, engagement, router]);

  if (loading || isAttendedViewer || String(company || '').trim()) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-700" />
      </div>
    );
  }

  return <AuroraPortfolioWorkspace />;
}
