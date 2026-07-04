'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Turmas vivem na página principal do curso — redireciona para manter links antigos. */
export default function ForgeTurmasPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/hub/forge/cursos/${id}`);
  }, [id, router]);

  return null;
}
