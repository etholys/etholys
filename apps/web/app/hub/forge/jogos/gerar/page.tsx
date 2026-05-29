'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Rota legada — jogos são atividades dentro de cursos, não um módulo à parte.
 */
export default function ForgeJogosGerarRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');

  useEffect(() => {
    if (courseId) {
      router.replace(`/hub/forge/cursos/${courseId}?edit=1&focus=game`);
    } else {
      router.replace('/hub/forge/cursos');
    }
  }, [courseId, router]);

  return (
    <p className="text-sm text-slate-500">
      A redirecionar — os jogos são adicionados dentro do curso, como qualquer outra atividade.
    </p>
  );
}
