'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ForgeLiveStudio } from '@/components/forge/ForgeLiveStudio';
import { useForgeT } from '@/lib/forge/use-forge-t';
import type { ExpedicionSlide } from '@/lib/forge/expedicion-presentacion-slides';
import type { ForgeLiveConfig } from '@/lib/forge/delivery';

type CoursePayload = {
  id: string;
  title: string;
  canFacilitate?: boolean;
  liveConfig?: ForgeLiveConfig;
  presentationSlides?: ExpedicionSlide[];
  hasPresentation?: boolean;
  presentationEmbedUrl?: string | null;
  modules: { activities: { id: string; type: string }[] }[];
};

export default function ForgeSalonPage() {
  const ft = useForgeT();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CoursePayload | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!c.canFacilitate) {
      router.replace(`/hub/forge/cursos/${id}`);
      return;
    }
    setCourse(c);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const gameActivityId = useMemo(() => {
    if (!course) return null;
    for (const mod of course.modules) {
      const game = mod.activities.find((a) => a.type === 'game');
      if (game) return game.id;
    }
    return null;
  }, [course]);

  const presentationPdfUrl = course?.hasPresentation
    ? `/api/forge/courses/${id}/presentacion/file`
    : null;

  if (loading) {
    return <p className="p-8 text-sm text-slate-500">{ft('forge.general.loading')}</p>;
  }

  if (!course) {
    return <p className="p-8 text-sm text-red-600">{ft('forge.general.error')}</p>;
  }

  return (
    <ForgeLiveStudio
      courseId={course.id}
      courseTitle={course.title}
      liveConfig={course.liveConfig ?? {}}
      presentationSlides={(course.presentationSlides ?? []) as ExpedicionSlide[]}
      presentationPdfUrl={presentationPdfUrl}
      presentationEmbedUrl={course.presentationEmbedUrl}
      gameActivityId={gameActivityId}
    />
  );
}
