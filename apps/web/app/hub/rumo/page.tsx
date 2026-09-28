'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Nomes antigos: RUMO → POLARIS */
export default function RumoRedirect() {
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    const q = search.toString();
    router.replace(`/hub/polaris${q ? `?${q}` : ''}`);
  }, [router, search]);
  return null;
}
