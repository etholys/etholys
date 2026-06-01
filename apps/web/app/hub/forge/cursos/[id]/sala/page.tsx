'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ForgeExpedicionRoom } from '@/components/forge/ForgeExpedicionRoom';
import { useForgeT } from '@/lib/forge/use-forge-t';
import type { ExpedicionSlide } from '@/lib/forge/expedicion-presentacion-slides';
import type { ForgeLiveConfig } from '@/lib/forge/delivery';

type CoursePayload = {
  id: string;
  title: string;
  canFacilitate?: boolean;
  liveConfig?: ForgeLiveConfig;
  jitsiBaseUrl?: string;
  presentationSlides?: ExpedicionSlide[];
  hasPresentation?: boolean;
  presentationEmbedUrl?: string | null;
  modules: { activities: { id: string; type: string }[] }[];
};

function ForgeSalaContent() {
  const ft = useForgeT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CoursePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const hasRoom =
    Boolean(searchParams.get('session')?.trim()) || Boolean(searchParams.get('group')?.trim());

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/forge/courses/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setCourse(null);
      setLoading(false);
      return;
    }
    const c = data.course as CoursePayload;
    setCourse(c);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading && !hasRoom && id) {
      router.replace(`/hub/forge/cursos/${id}/turmas`);
    }
  }, [loading, hasRoom, id, router]);

  const gameActivityId = useMemo(() => {
    if (!course) return null;
    for (const mod of course.modules) {
      const game = mod.activities.find((a) => a.type === 'game');
      if (game) return game.id;
    }
    return null;
  }, [course]);

  if (loading || !hasRoom) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-8 text-red-600">{ft('forge.general.error')}</div>
    );
  }

  const role = course.canFacilitate ? 'facilitator' : 'learner';

  return (
    <ForgeExpedicionRoom
      courseId={course.id}
      courseTitle={course.title}
      role={role}
      liveConfig={course.liveConfig ?? {}}
      jitsiBaseUrl={course.jitsiBaseUrl}
      presentationSlides={(course.presentationSlides ?? []) as ExpedicionSlide[]}
      presentationPdfUrl={
        course.hasPresentation ? `/api/forge/courses/${course.id}/presentacion/file` : null
      }
      presentationEmbedUrl={course.presentationEmbedUrl}
      gameActivityId={gameActivityId}
    />
  );
}

export default function ForgeSalaPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
        </div>
      }
    >
      <ForgeSalaContent />
    </Suspense>
  );
}
