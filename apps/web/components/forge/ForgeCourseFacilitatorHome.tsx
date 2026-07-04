'use client';

import Link from 'next/link';
import {
  Users,
  Pencil,
  Eye,
  Settings,
  BarChart3,
  GraduationCap,
  BookOpen,
  Video,
} from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';

type Props = {
  courseId: string;
  title: string;
  coverEmoji: string;
  status: string;
  deliveryMode: string;
  gamePlayMode: string;
  onEdit: () => void;
  onPreviewAsLearner: () => void;
};

export function ForgeCourseFacilitatorHome({
  courseId,
  title,
  coverEmoji,
  status,
  deliveryMode,
  gamePlayMode,
  onEdit,
  onPreviewAsLearner,
}: Props) {
  const ft = useForgeT();
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-indigo-50 p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
          {ft('forge.facilitator.mode')}
        </p>
        <div className="mt-2 flex flex-wrap items-start gap-4">
          <span className="text-5xl">{coverEmoji}</span>
          <div>
            <h1 className="text-2xl font-black text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {ft('forge.facilitator.meta', {
                status,
                mode: deliveryMode,
                game:
                  gamePlayMode === 'personal'
                    ? ft('forge.facilitator.gamePersonal')
                    : ft('forge.facilitator.gameShared'),
              })}
            </p>
            <p className="mt-2 text-sm text-violet-900 max-w-2xl">{ft('forge.facilitator.blurb')}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          href={`/hub/forge/cursos/${courseId}/turmas`}
          icon={Video}
          title={ft('forge.editions.title')}
          desc={ft('forge.editions.subtitle')}
          color="sky"
        />
        <ActionCard
          href={`/hub/forge/cursos/${courseId}/alumnos`}
          icon={Users}
          title={ft('forge.facilitator.alumnos')}
          desc={ft('forge.facilitator.alumnosDesc')}
          color="violet"
        />
        <button type="button" onClick={onEdit} className="text-left">
          <ActionCard
            icon={Pencil}
            title={ft('forge.facilitator.edit')}
            desc={ft('forge.facilitator.editDesc')}
            color="blue"
            as="div"
          />
        </button>
        <button type="button" onClick={onPreviewAsLearner} className="text-left">
          <ActionCard
            icon={Eye}
            title={ft('forge.facilitator.preview')}
            desc={ft('forge.facilitator.previewDesc')}
            color="emerald"
            as="div"
          />
        </button>
        <Link href={`/hub/forge/cursos/${courseId}?edit=1`} className="text-left">
          <ActionCard
            icon={Settings}
            title={ft('forge.facilitator.settings')}
            desc={ft('forge.facilitator.settingsDesc')}
            color="sky"
            as="div"
          />
        </Link>
        <Link href={`/hub/forge/cursos/${courseId}/libro`} className="text-left">
          <ActionCard
            icon={BookOpen}
            title={ft('forge.facilitator.libro')}
            desc={ft('forge.facilitator.libroDesc')}
            color="violet"
            as="div"
          />
        </Link>
        <Link href={`/hub/forge/cursos/${courseId}/analytics`} className="text-left">
          <ActionCard
            icon={BarChart3}
            title={ft('forge.facilitator.analytics')}
            desc={ft('forge.facilitator.analyticsDesc')}
            color="amber"
            as="div"
          />
        </Link>
        <Link href="/hub/forge/trilhas" className="text-left">
          <ActionCard
            icon={GraduationCap}
            title={ft('forge.facilitator.trails')}
            desc={ft('forge.facilitator.trailsDesc')}
            color="slate"
            as="div"
          />
        </Link>
      </div>
    </div>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  desc,
  color,
  as = 'link',
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  color: 'violet' | 'blue' | 'emerald' | 'sky' | 'amber' | 'slate';
  as?: 'link' | 'div';
}) {
  const colors = {
    violet: 'border-violet-200 hover:border-violet-400 bg-white',
    blue: 'border-blue-200 hover:border-blue-400 bg-white',
    emerald: 'border-emerald-200 hover:border-emerald-400 bg-white',
    sky: 'border-sky-200 hover:border-sky-400 bg-white',
    amber: 'border-amber-200 hover:border-amber-400 bg-white',
    slate: 'border-slate-200 hover:border-slate-400 bg-white',
  };
  const iconColors = {
    violet: 'text-violet-600',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    sky: 'text-sky-600',
    amber: 'text-amber-600',
    slate: 'text-slate-600',
  };
  const className = `block rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${colors[color]}`;
  const inner = (
    <>
      <Icon className={`h-7 w-7 ${iconColors[color]}`} />
      <p className="mt-3 font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-600">{desc}</p>
    </>
  );
  if (as === 'div') return <div className={className}>{inner}</div>;
  return (
    <Link href={href!} className={className}>
      {inner}
    </Link>
  );
}
