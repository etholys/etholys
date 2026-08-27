'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { NexusSectorDiagnosticWizard } from '@/components/nexus/NexusSectorDiagnosticWizard';

export default function NexusDiagnosisPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
        </div>
      }
    >
      <NexusSectorDiagnosticWizard />
    </Suspense>
  );
}
