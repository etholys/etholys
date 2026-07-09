'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ForgeExpedicionV2Workspace } from '@/components/forge/ForgeExpedicionV2Workspace';
import { ForgeMaturityQuizGate } from '@/components/forge/ForgeMaturityQuizGate';
import { ForgeSustainabilityDashboard } from '@/components/forge/ForgeSustainabilityDashboard';
import { useExpedicionV2 } from '@/lib/forge/expedicion-v2/useExpedicionV2';
import { EXPEDICION_V2_SHELL } from '@/lib/forge/expedicion-v2/theme';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ForgeMiMapaPage() {
  const ft = useForgeT();
  const { id: courseId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room')?.trim() || null;
  const [title, setTitle] = useState('');
  const [quizModal, setQuizModal] = useState<null | 'pre' | 'post'>(null);
  const { v2, teamMode, patch, loading } = useExpedicionV2(courseId, { roomId });

  useEffect(() => {
    fetch(`/api/forge/courses/${courseId}/my-journey`)
      .then((r) => r.json())
      .then((d) => setTitle(d.course?.title ?? ''))
      .catch(() => {});
  }, [courseId]);

  const salaHref = roomId
    ? `/hub/forge/cursos/${courseId}/sala?${searchParams.toString()}`
    : `/hub/forge/cursos/${courseId}/sala`;

  if (loading || !v2) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#1B5E4B]/30 border-t-[#1B5E4B]" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6 -m-4 p-4 md:p-6 min-h-screen', EXPEDICION_V2_SHELL)}>
      {quizModal && (
        <ForgeMaturityQuizGate
          side={quizModal}
          onClose={() => setQuizModal(null)}
          onComplete={(answers) => {
            const action = quizModal === 'pre' ? 'complete_pre_quiz' : 'complete_post_quiz';
            void patch({ action, answers }).then(() => setQuizModal(null));
          }}
        />
      )}
      <Link
        href={salaHref}
        className="inline-flex items-center gap-1 text-sm text-[#1B5E4B] font-semibold hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {title || ft('forge.mymap.defaultCourse')}
      </Link>
      {teamMode && (
        <p className="text-xs text-[#1B5E4B]/80 font-semibold">
          Mapa compartido de la mesa — cambios visibles para todo el equipo.
        </p>
      )}
      {v2.phase === 'pre_quiz' && (
        <button
          type="button"
          onClick={() => setQuizModal('pre')}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white"
        >
          <ClipboardList className="h-4 w-4" />
          {ft('forge.v2.lobbyTilePreQuiz')}
        </button>
      )}
      {v2.phase === 'post_quiz' && (
        <button
          type="button"
          onClick={() => setQuizModal('post')}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white"
        >
          <ClipboardList className="h-4 w-4" />
          {ft('forge.v2.lobbyTilePostQuiz')}
        </button>
      )}
      {v2.phase === 'finished' && v2.finalScoreBreakdown && (
        <ForgeSustainabilityDashboard breakdown={v2.finalScoreBreakdown} />
      )}
      <ForgeExpedicionV2Workspace courseId={courseId} roomId={roomId} />
    </div>
  );
}
