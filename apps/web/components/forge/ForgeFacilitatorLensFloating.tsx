'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, User, Users, X } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';
import type { FacilitatorLens } from '@/components/forge/ForgeFacilitatorLensBar';

type TeamRow = { roomId: string; name: string };
type LearnerRow = { userId: string; name: string | null };

export function ForgeFacilitatorLensFloating({
  courseId,
  lens,
  onLensChange,
}: {
  courseId: string;
  lens: FacilitatorLens;
  onLensChange: (lens: FacilitatorLens) => void;
}) {
  const ft = useForgeT();
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => {
      fetch(`/api/forge/courses/${courseId}/expedicion-v2/overview`)
        .then((r) => r.json())
        .then((d) => {
          setTeams(
            (d.teams ?? []).map((t: { roomId: string; name: string }) => ({
              roomId: t.roomId,
              name: t.name,
            }))
          );
          setLearners(
            (d.learners ?? []).map((l: { userId: string; name: string | null }) => ({
              userId: l.userId,
              name: l.name,
            }))
          );
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [courseId]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const label =
    lens.kind === 'mine'
      ? ft('forge.v2.lensMine')
      : lens.kind === 'all'
        ? ft('forge.v2.lensAll')
        : lens.name;

  const apply = (next: FacilitatorLens) => {
    onLensChange(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-lg transition',
          open
            ? 'border-[#145A45] bg-[#145A45] text-white'
            : 'border-[#145A45]/25 bg-white/95 text-[#145A45] hover:bg-white'
        )}
        title={ft('forge.v2.lensLabel')}
        aria-label={ft('forge.v2.lensLabel')}
      >
        <Eye className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(92vw,240px)] rounded-xl border border-[#145A45]/20 bg-white p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#145A45]/70">
              {ft('forge.v2.lensLabel')}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-[#145A45]/50 hover:bg-[#F5F2EA]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mb-2 truncate px-1 text-xs font-semibold text-[#2E5C9A]">{label}</p>
          <div className="flex flex-col gap-0.5 max-h-[50vh] overflow-y-auto">
            <LensOption active={lens.kind === 'mine'} onClick={() => apply({ kind: 'mine' })}>
              {ft('forge.v2.lensMine')}
            </LensOption>
            <LensOption active={lens.kind === 'all'} onClick={() => apply({ kind: 'all' })}>
              {ft('forge.v2.lensAll')}
            </LensOption>
            {teams.map((t) => (
              <LensOption
                key={t.roomId}
                active={lens.kind === 'team' && lens.roomId === t.roomId}
                onClick={() => apply({ kind: 'team', roomId: t.roomId, name: t.name })}
              >
                <Users className="h-3 w-3 shrink-0 opacity-70" />
                {t.name}
              </LensOption>
            ))}
            {learners.map((l) => (
              <LensOption
                key={l.userId}
                active={lens.kind === 'learner' && lens.userId === l.userId}
                onClick={() =>
                  apply({
                    kind: 'learner',
                    userId: l.userId,
                    name: l.name ?? l.userId.slice(0, 8),
                  })
                }
              >
                <User className="h-3 w-3 shrink-0 opacity-70" />
                {l.name ?? l.userId.slice(0, 8)}
              </LensOption>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LensOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition',
        active ? 'bg-[#145A45]/12 text-[#145A45]' : 'text-[#1A3D5C] hover:bg-[#F5F2EA]'
      )}
    >
      {children}
    </button>
  );
}
