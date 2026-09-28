'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** A central de comando passou para PULSO. */
export default function NexusCampoRedirect() {
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    const q = search.toString();
    router.replace(`/hub/pulso${q ? `?${q}` : ''}`);
  }, [router, search]);
  return null;
}
