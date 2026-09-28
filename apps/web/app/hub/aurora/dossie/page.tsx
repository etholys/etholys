'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AuroraDossierWorkspace } from '@/components/etholys/AuroraDossierWorkspace';

export default function AuroraDossierPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-amber-700" />}>
      <AuroraDossierWorkspace />
    </Suspense>
  );
}
