'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { NexusCoachPanel } from '@/components/nexus/NexusCoachPanel';

export default function NexusCoachPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      }
    >
      <NexusCoachPanel embeddedOnHub={false} />
    </Suspense>
  );
}
