'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { MeetRecapWorkspace } from '@/components/meet/MeetRecapWorkspace';

export default function MeetRecapsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
        </div>
      }
    >
      <MeetRecapWorkspace />
    </Suspense>
  );
}
