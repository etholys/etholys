'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ForgePersonalMap } from '@/components/forge/ForgePersonalMap';
import { forgeActivityLabel } from '@/lib/forge/activity-ui';
import type { JourneyMapState, JourneyMaterial, JourneyTimelineEntry } from '@/lib/forge/learner-journey-types';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';
import { ArrowLeft } from 'lucide-react';

export default function ForgeAlumnoDossierPage() {
  const ft = useForgeT();
  const loc = useForgeLocale();
  const { id: courseId, userId } = useParams<{ id: string; userId: string }>();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mapState, setMapState] = useState<JourneyMapState | null>(null);
  const [materials, setMaterials] = useState<JourneyMaterial[]>([]);
  const [timeline, setTimeline] = useState<JourneyTimelineEntry[]>([]);
  const [activityProgress, setActivityProgress] = useState<
    { title: string; type: string; moduleTitle: string; status: string; completedAt: string | null }[]
  >([]);

  useEffect(() => {
    fetch(`/api/forge/courses/${courseId}/learners/${userId}`)
      .then((r) => r.json())
      .then((d) => {
        setName(d.user?.name ?? '');
        setEmail(d.user?.email ?? '');
        if (d.journey) {
          setMapState(d.journey.mapState);
          setMaterials(d.journey.materials ?? []);
          setTimeline(d.journey.timeline ?? []);
        }
        setActivityProgress(d.activityProgress ?? []);
      })
      .finally(() => setLoading(false));
  }, [courseId, userId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-600/30 border-t-violet-600" />
      </div>
    );
  }

  if (!mapState) return <p className="text-red-600">{ft('forge.dossier.unavailable')}</p>;

  function statusLabel(status: string) {
    if (status === 'completed') return ft('forge.dossier.status.completed');
    return ft('forge.dossier.status.pending');
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/hub/forge/cursos/${courseId}/alumnos`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {ft('forge.dossier.backList')}
      </Link>
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
        <h1 className="text-xl font-black text-violet-950">{name || ft('forge.dossier.defaultName')}</h1>
        <p className="text-sm text-violet-800">{email}</p>
        <p className="text-xs text-violet-600 mt-1">
          {ft('forge.dossier.accountId')}: {userId}
        </p>
      </div>

      <ForgePersonalMap
        courseId={courseId}
        mapState={mapState}
        materials={materials}
        timeline={timeline}
        showLinks={false}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">{ft('forge.dossier.allActivities')}</h2>
        <ul className="mt-3 space-y-2">
          {activityProgress.map((p) => (
            <li
              key={p.title + p.moduleTitle}
              className="flex justify-between gap-4 rounded-lg border border-slate-100 px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{p.title}</span>
                <span className="text-slate-500">
                  {' '}
                  · {forgeActivityLabel(p.type, loc)} · {p.moduleTitle}
                </span>
              </span>
              <span className={p.status === 'completed' ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                {statusLabel(p.status)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
