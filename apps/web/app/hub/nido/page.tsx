'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { BusinessDossierWorkspace } from '@/components/etholys/BusinessDossierWorkspace';

export default function NidoPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-amber-700" />}>
      <BusinessDossierWorkspace mode="nido" />
    </Suspense>
  );
}
