'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AuroraJourneyWorkspace } from '@/components/etholys/AuroraJourneyWorkspace';

/** Fluxo contínuo: diagnóstico → radiografia → validar → rota. */
export default function AuroraDiagnosticPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-amber-700" />}>
      <AuroraJourneyWorkspace />
    </Suspense>
  );
}
