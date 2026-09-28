'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { PolarisMapWorkspace } from '@/components/etholys/PolarisMapWorkspace';

export default function PolarisPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-teal-700" />}>
      <PolarisMapWorkspace />
    </Suspense>
  );
}
