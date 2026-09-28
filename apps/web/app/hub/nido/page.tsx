'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Nomes antigos: NIDO → AURORA */
export default function NidoRedirect() {
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    const q = search.toString();
    router.replace(`/hub/aurora${q ? `?${q}` : ''}`);
  }, [router, search]);
  return null;
}
