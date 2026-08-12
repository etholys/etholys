'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { MeetRecapWorkspace } from '@/components/meet/MeetRecapWorkspace';

function RecapDetailInner() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <MeetRecapWorkspace sessionId={sessionId} />;
}

export default function MeetRecapDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
        </div>
      }
    >
      <RecapDetailInner />
    </Suspense>
  );
}
