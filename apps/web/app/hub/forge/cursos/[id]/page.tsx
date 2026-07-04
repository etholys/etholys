'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useApp } from '@/app/providers';
import { ForgeCourseEditor } from '@/components/forge/ForgeCourseEditor';
import { ForgeCourseHome } from '@/components/forge/ForgeCourseHome';
import { ForgeCourseFacilitatorHome } from '@/components/forge/ForgeCourseFacilitatorHome';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { ForgeDeliverySettings } from '@/components/forge/ForgeDeliverySettings';
import { ForgeLiveSessionsManager } from '@/components/forge/ForgeLiveSessionsManager';
import { ForgeProgramPicker } from '@/components/forge/ForgeProgramPicker';
import {
  showsLiveFeatures,
  type ForgeDeliveryMode,
  type ForgeLiveConfig,
} from '@/lib/forge/delivery';
import { ForgeLivePanel } from '@/components/forge/ForgeLivePanel';
import { ArrowLeft } from 'lucide-react';

type Activity = { id: string; type: string; title: string; sortOrder: number };
type Module = { id: string; title: string; activities: Activity[] };

type CourseDetail = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  coverEmoji: string;
  deliveryMode?: ForgeDeliveryMode;
  gamePlayMode?: 'personal' | 'shared_live';
  cohortMode?: 'invite_only' | 'open';
  liveConfig?: ForgeLiveConfig;
  canFacilitate?: boolean;
  programId?: string | null;
  companyId?: string;
  programOrderBlocked?: {
    ok: boolean;
    requiredCourseId?: string;
    requiredCourseTitle?: string;
  };
  hasLibro?: boolean;
  libroPdfName?: string | null;
  progressPercent?: number;
  learner?: { xp: number; level: number };
  modules: Module[];
};

export default function ForgeCursoDetailPage() {
  const ft = useForgeT();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { activeCompanyId } = useApp();
  const editParam = searchParams.get('edit');
  const editContent = editParam === '1' || editParam === 'content';
  const editSettings = editParam === 'settings';
  const inEditMode = editContent || editSettings;
  const previewLearner = searchParams.get('preview') === 'learner';
  const fromEdition = searchParams.get('from') === 'edition';
  const editionReturnId = searchParams.get('editionId');
  const focusGame = searchParams.get('focus') === 'game';
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, string>>({});
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [certCode, setCertCode] = useState<string | null>(null);

  const backHref =
    fromEdition && editionReturnId
      ? `/hub/forge/cursos/${id}/turmas/${editionReturnId}`
      : `/hub/forge/cursos/${id}`;

  const load = useCallback(async () => {
    setLoading(true);
    const q = activeCompanyId ? `?companyId=${encodeURIComponent(activeCompanyId)}` : '';
    const res = await fetch(`/api/forge/courses/${id}${q}`);
    const data = await res.json();
    if (res.ok) {
      setCourse(data.course);
      if (data.course?.learner != null) setEnrolled(true);
      const map: Record<string, string> = {};
      for (const p of data.activityProgress ?? []) {
        map[p.activityId] = p.status;
      }
      setProgressMap(map);
    }
    if (res.ok && data.course?.progressPercent === 100) {
      fetch('/api/forge/certificates?mine=1')
        .then((r) => r.json())
        .then((cd) => {
          const found = (cd.certificates ?? []).find(
            (c: { courseId: string; verifyCode: string }) => c.courseId === id
          );
          if (found) setCertCode(found.verifyCode);
        });
    }
    setLoading(false);
  }, [id, activeCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id || enrolled || !course) return;
    if (course.canFacilitate && !previewLearner) return;
    fetch('/api/forge/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: id }),
    })
      .then((r) => {
        if (r.ok) setEnrolled(true);
      })
      .catch(() => {});
  }, [id, enrolled, course, previewLearner]);

  async function enroll() {
    const res = await fetch('/api/forge/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: id }),
    });
    if (res.ok) {
      setEnrolled(true);
      await load();
    }
  }

  function nextActivityId(): string | null {
    if (!course) return null;
    for (const mod of course.modules) {
      for (const a of mod.activities) {
        if (progressMap[a.id] !== 'completed') return a.id;
      }
    }
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600" />
      </div>
    );
  }
  if (!course) return <p className="text-sm text-red-600">{ft('forge.course.notFound')}</p>;

  if (course.programOrderBlocked && !course.programOrderBlocked.ok) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center space-y-4">
        <p className="font-bold text-amber-950">{ft('forge.program.blocked')}</p>
        <p className="text-sm text-amber-900">
          {ft('forge.program.completeFirst')}{' '}
          <strong>{course.programOrderBlocked.requiredCourseTitle}</strong>
        </p>
        <Link
          href={`/hub/forge/cursos/${course.programOrderBlocked.requiredCourseId}`}
          className="inline-block rounded-xl bg-amber-700 px-5 py-2 text-sm font-bold text-white"
        >
          {ft('forge.program.goPrev')}
        </Link>
      </div>
    );
  }

  if (inEditMode && course.canFacilitate) {
    return (
      <div className="space-y-6">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> {ft('forge.course.backFacilitator')}
        </Link>
        {editContent && course.companyId && (
          <ForgeProgramPicker
            courseId={id}
            companyId={course.companyId}
            programId={course.programId}
            onUpdated={load}
          />
        )}
        {editSettings && (
          <>
            <ForgeDeliverySettings
              deliveryMode={course.deliveryMode ?? 'async'}
              gamePlayMode={course.gamePlayMode ?? 'personal'}
              cohortMode={course.cohortMode ?? 'invite_only'}
              liveConfig={course.liveConfig ?? {}}
              onSave={async (mode, live, game, cohort) => {
                const res = await fetch(`/api/forge/courses/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    deliveryMode: mode,
                    liveConfig: live,
                    gamePlayMode: game,
                    cohortMode: cohort,
                  }),
                });
                if (!res.ok) {
                  const d = await res.json();
                  alert(d.error || ft('forge.course.saveError'));
                  return;
                }
                await load();
              }}
            />
            {showsLiveFeatures(course.deliveryMode ?? 'async') && (
              <>
                <ForgeLivePanel
                  courseId={id}
                  deliveryMode={course.deliveryMode ?? 'blended'}
                  liveConfig={course.liveConfig ?? {}}
                  showFacilitatorRoom
                  showFacilitatorNotes
                />
                <ForgeLiveSessionsManager courseId={id} modules={course.modules} />
              </>
            )}
          </>
        )}
        {editContent && (
          <ForgeCourseEditor
            courseId={id}
            modules={course.modules}
            onChange={load}
            initialFocusGame={focusGame}
          />
        )}
      </div>
    );
  }

  if (course.canFacilitate && !previewLearner) {
    return (
      <ForgeCourseFacilitatorHome
        courseId={id}
        title={course.title}
        description={course.description}
        coverEmoji={course.coverEmoji}
        status={course.status}
        deliveryMode={course.deliveryMode ?? 'async'}
        gamePlayMode={course.gamePlayMode ?? 'personal'}
        onPreviewAsLearner={() => {
          window.location.href = `/hub/forge/cursos/${id}?preview=learner`;
        }}
      />
    );
  }

  return (
    <ForgeCourseHome
      courseId={id}
      title={course.title}
      description={course.description}
      coverEmoji={course.coverEmoji}
      status={course.status}
      deliveryMode={course.deliveryMode ?? 'async'}
      liveConfig={course.liveConfig ?? {}}
      progressPercent={course.progressPercent}
      learner={course.learner}
      modules={course.modules}
      progressMap={progressMap}
      certCode={certCode}
      enrolled={enrolled}
      nextActivityId={nextActivityId()}
      canFacilitate={course.canFacilitate}
      hasLibro={course.hasLibro}
      onEnroll={enroll}
      onEdit={() => {
        window.location.href = `/hub/forge/cursos/${id}?edit=content`;
      }}
    />
  );
}
