'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AuroraAttendedHome } from '@/components/etholys/AuroraAttendedHome';

export default function AuroraAttendedPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-amber-700" />}>
      <AuroraAttendedHome />
    </Suspense>
  );
}
