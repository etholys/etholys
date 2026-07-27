'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { MeetRoomClient } from '@/components/meet/MeetRoomClient';

function MeetRoomContent() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <MeetRoomClient sessionId={sessionId} />;
}

export default function MeetRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
        </div>
      }
    >
      <MeetRoomContent />
    </Suspense>
  );
}
