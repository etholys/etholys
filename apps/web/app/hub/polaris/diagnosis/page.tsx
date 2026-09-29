'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { PolarisBaselineWorkspace } from '@/components/etholys/PolarisBaselineWorkspace';

/** Linha de base: maturidade 1–5 por bloco — ponto de partida do consultor permanente. */
export default function PolarisDiagnosisPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-teal-300" />}>
      <PolarisBaselineWorkspace />
    </Suspense>
  );
}
