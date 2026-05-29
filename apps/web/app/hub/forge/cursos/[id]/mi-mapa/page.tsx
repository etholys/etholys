'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ForgePersonalMap } from '@/components/forge/ForgePersonalMap';
import type { JourneyMapState, JourneyMaterial, JourneyTimelineEntry } from '@/lib/forge/learner-journey-types';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { ArrowLeft } from 'lucide-react';

export default function ForgeMiMapaPage() {
  const ft = useForgeT();
  const { id: courseId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [mapState, setMapState] = useState<JourneyMapState | null>(null);
  const [materials, setMaterials] = useState<JourneyMaterial[]>([]);
  const [timeline, setTimeline] = useState<JourneyTimelineEntry[]>([]);

  useEffect(() => {
    fetch(`/api/forge/courses/${courseId}/my-journey`)
      .then((r) => r.json())
      .then((d) => {
        if (d.journey) {
          setMapState(d.journey.mapState);
          setMaterials(d.journey.materials ?? []);
          setTimeline(d.journey.timeline ?? []);
        }
        setTitle(d.course?.title ?? '');
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-600" />
      </div>
    );
  }

  if (!mapState) {
    return <p className="text-red-600">{ft('forge.mymap.loadError')}</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/hub/forge/cursos/${courseId}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {title || ft('forge.mymap.defaultCourse')}
      </Link>
      <ForgePersonalMap
        courseId={courseId}
        mapState={mapState}
        materials={materials}
        timeline={timeline}
      />
    </div>
  );
}
