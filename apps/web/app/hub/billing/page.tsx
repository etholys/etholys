'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/** Billing vive na central de controlo — mantém query (ex. sku). */
function BillingRedirectInner() {
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    const q = new URLSearchParams(search.toString());
    q.set('s', 'billing');
    router.replace(`/hub/admin?${q.toString()}`);
  }, [router, search]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07111A]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/25 border-t-teal-400" />
    </div>
  );
}

export default function HubBillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#07111A]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/25 border-t-teal-400" />
        </div>
      }
    >
      <BillingRedirectInner />
    </Suspense>
  );
}
