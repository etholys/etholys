'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AuroraDiagnosticWorkspace } from '@/components/etholys/AuroraDiagnosticWorkspace';

export default function AuroraDiagnosticPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-amber-700" />}>
      <AuroraDiagnosticWorkspace />
    </Suspense>
  );
}
