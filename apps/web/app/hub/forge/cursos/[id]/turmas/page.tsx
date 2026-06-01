'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ForgeTutorLobby } from '@/components/forge/ForgeTutorLobby';
import { useForgeT } from '@/lib/forge/use-forge-t';

export default function ForgeTurmasPage() {
  const ft = useForgeT();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-4">
      <Link
        href={`/hub/forge/cursos/${id}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {ft('forge.alumnos.back')}
      </Link>
      <ForgeTutorLobby courseId={id} />
    </div>
  );
}
