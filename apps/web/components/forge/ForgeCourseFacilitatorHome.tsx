'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Eye, GraduationCap, Info, MoreVertical, Pencil, X } from 'lucide-react';
import { ForgeTutorLobby } from '@/components/forge/ForgeTutorLobby';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { deliveryModeLabel } from '@/lib/forge/delivery';

type Props = {
  courseId: string;
  title: string;
  description?: string | null;
  coverEmoji: string;
  status: string;
  deliveryMode: string;
  gamePlayMode: string;
  onPreviewAsLearner: () => void;
};

export function ForgeCourseFacilitatorHome({
  courseId,
  title,
  description,
  coverEmoji,
  status,
  deliveryMode,
  gamePlayMode,
  onPreviewAsLearner,
}: Props) {
  const ft = useForgeT();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const gameLabel =
    gamePlayMode === 'personal'
      ? ft('forge.facilitator.gamePersonal')
      : ft('forge.facilitator.gameShared');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
            {ft('forge.facilitator.mode')}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-4xl shrink-0">{coverEmoji}</span>
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-slate-900 truncate">{title}</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {ft('forge.facilitator.meta', { status, mode: deliveryMode, game: gameLabel })}
              </p>
            </div>
          </div>
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MoreVertical className="h-4 w-4" />
            {ft('forge.facilitator.menu')}
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            >
              <MenuItem
                icon={Pencil}
                label={ft('forge.facilitator.menuContent')}
                onClick={() => {
                  setMenuOpen(false);
                  router.push(`/hub/forge/cursos/${courseId}?edit=content`);
                }}
              />
              <MenuItem
                icon={Info}
                label={ft('forge.facilitator.menuInfo')}
                onClick={() => {
                  setMenuOpen(false);
                  setInfoOpen(true);
                }}
              />
              <MenuItem
                icon={BookOpen}
                label={ft('forge.facilitator.menuLibro')}
                href={`/hub/forge/cursos/${courseId}/libro`}
                onNavigate={() => setMenuOpen(false)}
              />
              <MenuItem
                icon={GraduationCap}
                label={ft('forge.facilitator.menuTrails')}
                href="/hub/forge/trilhas"
                onNavigate={() => setMenuOpen(false)}
              />
              <div className="my-1 border-t border-slate-100" />
              <MenuItem
                icon={Eye}
                label={ft('forge.facilitator.menuPreview')}
                onClick={() => {
                  setMenuOpen(false);
                  onPreviewAsLearner();
                }}
              />
            </div>
          )}
        </div>
      </div>

      {infoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-lg font-black text-slate-900">{ft('forge.facilitator.infoTitle')}</h2>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase text-slate-400">{ft('forge.facilitator.infoName')}</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{title}</dd>
              </div>
              {description ? (
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-400">
                    {ft('forge.facilitator.infoDescription')}
                  </dt>
                  <dd className="mt-0.5 text-slate-700 whitespace-pre-wrap">{description}</dd>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-400">{ft('forge.facilitator.infoStatus')}</dt>
                  <dd className="mt-0.5 font-medium text-slate-800 capitalize">{status}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-400">{ft('forge.facilitator.infoMode')}</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">
                    {deliveryModeLabel(deliveryMode as 'async')}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs font-bold uppercase text-slate-400">{ft('forge.facilitator.infoGame')}</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{gameLabel}</dd>
                </div>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className="mt-6 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              {ft('forge.general.close')}
            </button>
          </div>
        </div>
      )}

      <ForgeTutorLobby courseId={courseId} embedded />
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onClick,
  onNavigate,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
  onNavigate?: () => void;
}) {
  const className =
    'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50';
  if (href) {
    return (
      <Link href={href} className={className} onClick={onNavigate}>
        <Icon className="h-4 w-4 shrink-0 text-slate-500" />
        {label}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      <Icon className="h-4 w-4 shrink-0 text-slate-500" />
      {label}
    </button>
  );
}
