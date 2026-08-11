'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { MeetExternalCapture } from '@/components/meet/MeetExternalCapture';

function CaptureInner() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId')?.trim() || undefined;
  const sessionId = searchParams.get('sessionId')?.trim() || undefined;
  return <MeetExternalCapture companyId={companyId} sessionId={sessionId} />;
}

export default function MeetCapturePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0f1115]">
          <Loader2 className="h-8 w-8 animate-spin text-white/60" />
        </div>
      }
    >
      <CaptureInner />
    </Suspense>
  );
}
