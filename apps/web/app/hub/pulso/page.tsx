'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Nomes antigos: PULSO → RADAR */
export default function PulsoRedirect() {
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    const q = search.toString();
    router.replace(`/hub/radar${q ? `?${q}` : ''}`);
  }, [router, search]);
  return null;
}
