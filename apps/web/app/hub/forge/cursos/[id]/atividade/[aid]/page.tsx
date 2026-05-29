'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ForgeActivityPlayer } from '@/components/forge/ForgeActivityPlayer';
import { ForgeLearnShell, type ForgeLearnModule } from '@/components/forge/ForgeLearnShell';
import { inferCourseMode } from '@/lib/forge/activity-ui';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { type ForgeDeliveryMode, type ForgeLiveConfig, showsLiveFeatures } from '@/lib/forge/delivery';
import { pickFeaturedSession } from '@/lib/forge/live-sessions';
import { Zap } from 'lucide-react';

export default function ForgeAtividadePage() {
  const ft = useForgeT();
  const { id: courseId, aid } = useParams<{ id: string; aid: string }>();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [activity, setActivity] = useState<Parameters<typeof ForgeActivityPlayer>[0]['activity'] | null>(null);
  const [completed, setCompleted] = useState(false);
  const [xpGain, setXpGain] = useState<number | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [coverEmoji, setCoverEmoji] = useState('📚');
  const [progressPercent, setProgressPercent] = useState(0);
  const [learner, setLearner] = useState<{ xp: number; level: number } | undefined>();
  const [modules, setModules] = useState<ForgeLearnModule[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, string>>({});
  const [deliveryMode, setDeliveryMode] = useState<ForgeDeliveryMode>('async');
  const [liveConfig, setLiveConfig] = useState<ForgeLiveConfig>({});
  const [canFacilitate, setCanFacilitate] = useState(false);
  const [gamePlayMode, setGamePlayMode] = useState<'personal' | 'shared_live'>('personal');
  const [featuredLiveSessionId, setFeaturedLiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/forge/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    }).catch(() => {});

    fetch(`/api/forge/activities/${aid}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.activity) return;
        setTitle(data.activity.title);
        setType(data.activity.type);
        setCourseTitle(data.course?.title ?? '');
        setCompleted(data.progress?.status === 'completed');
        setActivity({
          id: data.activity.id,
          type: data.activity.type,
          title: data.activity.title,
          config: (data.activity.config as Record<string, unknown>) ?? {},
          gameSpecId: data.activity.gameSpecId,
          gameSpec: data.activity.gameSpec,
        });
      });

    fetch(`/api/forge/courses/${courseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.course) return;
        setCourseTitle(data.course.title);
        setCoverEmoji(data.course.coverEmoji ?? '📚');
        if (data.course.deliveryMode) setDeliveryMode(data.course.deliveryMode);
        if (data.course.liveConfig) setLiveConfig(data.course.liveConfig);
        setCanFacilitate(Boolean(data.course.canFacilitate));
        if (data.course.gamePlayMode) setGamePlayMode(data.course.gamePlayMode);
        if (showsLiveFeatures(data.course.deliveryMode ?? 'async')) {
          fetch(`/api/forge/courses/${courseId}/live-sessions`)
            .then((r) => r.json())
            .then((sd) => {
              const featured = pickFeaturedSession(sd.sessions ?? []);
              if (featured) setFeaturedLiveSessionId(featured.id);
            })
            .catch(() => {});
        }
        setProgressPercent(data.course.progressPercent ?? 0);
        if (data.course.learner) setLearner(data.course.learner);
        setModules(
          (data.course.modules ?? []).map((m: ForgeLearnModule) => ({
            id: m.id,
            title: m.title,
            activities: m.activities ?? [],
          }))
        );
        const map: Record<string, string> = {};
        for (const p of data.activityProgress ?? []) {
          map[p.activityId] = p.status;
        }
        setProgressMap(map);
      });
  }, [aid, courseId]);

  const allTypes = modules.flatMap((m) => m.activities.map((a) => a.type));
  const courseMode = inferCourseMode(allTypes);
  const currentModuleTitle =
    modules.find((m) => m.activities.some((a) => a.id === aid))?.title ?? undefined;

  return (
    <ForgeLearnShell
      courseId={courseId}
      courseTitle={courseTitle || ft('forge.mymap.defaultCourse')}
      coverEmoji={coverEmoji}
      progressPercent={progressPercent}
      learner={learner}
      modules={modules}
      progressMap={progressMap}
      currentActivityId={aid}
      activityTitle={title}
      activityType={type}
      deliveryMode={deliveryMode}
      liveConfig={liveConfig}
      currentModuleTitle={currentModuleTitle}
      footer={
        xpGain != null ? (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
            <Zap className="h-4 w-4" /> +{xpGain} XP
          </span>
        ) : courseMode === 'hybrid' ? (
          <p className="text-xs text-slate-500">{ft('forge.learn.hybridTrail')}</p>
        ) : undefined
      }
    >
      {activity ? (
        <ForgeActivityPlayer
          activity={activity}
          courseId={courseId}
          deliveryMode={deliveryMode}
          liveConfig={liveConfig}
          gamePlayMode={gamePlayMode}
          canFacilitate={canFacilitate}
          liveSessionId={featuredLiveSessionId}
          alreadyCompleted={completed}
          onDone={() => {
            fetch(`/api/forge/courses/${courseId}`)
              .then((r) => r.json())
              .then((d) => {
                if (d.course?.learner?.xp != null) setXpGain(d.course.learner.xp);
                setProgressPercent(d.course?.progressPercent ?? 0);
              })
              .finally(() => {
                setTimeout(() => router.push(`/hub/forge/cursos/${courseId}`), 1200);
              });
          }}
        />
      ) : (
        <p className="text-sm text-slate-500">{ft('forge.learn.loadingActivity')}</p>
      )}
      {!activity && (
        <Link href={`/hub/forge/cursos/${courseId}`} className="mt-4 text-sm text-blue-600 hover:underline">
          {ft('forge.learn.backCourse')}
        </Link>
      )}
    </ForgeLearnShell>
  );
}
