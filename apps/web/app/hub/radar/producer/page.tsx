'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function RedirectInner() {
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    const q = search.toString();
    router.replace(`/hub/radar${q ? `?${q}` : ''}`);
  }, [router, search]);
  return (
    <div className="flex min-h-[30vh] items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
    </div>
  );
}

export default function RadarProducerRedirect() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-emerald-300" />}>
      <RedirectInner />
    </Suspense>
  );
}
