'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ForgeExpedicionV2Workspace } from '@/components/forge/ForgeExpedicionV2Workspace';
import { ForgeMaturityQuizGate } from '@/components/forge/ForgeMaturityQuizGate';
import { ForgeSustainabilityDashboard } from '@/components/forge/ForgeSustainabilityDashboard';
import { useExpedicionV2 } from '@/lib/forge/expedicion-v2/useExpedicionV2';
import { EXPEDICION_V2_SHELL } from '@/lib/forge/expedicion-v2/theme';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ForgeMiMapaPage() {
  const ft = useForgeT();
  const { id: courseId } = useParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const { v2, patch, loading } = useExpedicionV2(courseId);

  useEffect(() => {
    fetch(`/api/forge/courses/${courseId}/my-journey`)
      .then((r) => r.json())
      .then((d) => setTitle(d.course?.title ?? ''))
      .catch(() => {});
  }, [courseId]);

  if (loading || !v2) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#1B5E4B]/30 border-t-[#1B5E4B]" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6 -m-4 p-4 md:p-6 min-h-screen', EXPEDICION_V2_SHELL)}>
      {v2.phase === 'pre_quiz' && (
        <ForgeMaturityQuizGate
          side="pre"
          onComplete={(answers) => patch({ action: 'complete_pre_quiz', answers })}
        />
      )}
      {v2.phase === 'post_quiz' && (
        <ForgeMaturityQuizGate
          side="post"
          onComplete={(answers) => patch({ action: 'complete_post_quiz', answers })}
        />
      )}
      <Link
        href={`/hub/forge/cursos/${courseId}/sala`}
        className="inline-flex items-center gap-1 text-sm text-[#1B5E4B] font-semibold hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {title || ft('forge.mymap.defaultCourse')}
      </Link>
      {v2.phase === 'finished' && v2.finalScoreBreakdown && (
        <ForgeSustainabilityDashboard breakdown={v2.finalScoreBreakdown} />
      )}
      <ForgeExpedicionV2Workspace courseId={courseId} />
    </div>
  );
}
