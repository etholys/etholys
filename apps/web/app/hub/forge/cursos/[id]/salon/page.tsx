'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Salón legado → sala de jogo unificada. */
export default function ForgeSalonRedirectPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    router.replace(`/hub/forge/cursos/${id}/sala`);
  }, [id, router]);
  return null;
}
