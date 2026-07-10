'use client';

import { useEffect, useState } from 'react';
import { Eye, Users, User } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';
import { EXPEDICION_FAC_TOOLBAR } from '@/lib/forge/expedicion-v2/theme';

export type FacilitatorLens =
  | { kind: 'mine' }
  | { kind: 'all' }
  | { kind: 'team'; roomId: string; name: string }
  | { kind: 'learner'; userId: string; name: string };

type TeamRow = { roomId: string; name: string; playGroupId: string };
type LearnerRow = { userId: string; name: string | null };

export function ForgeFacilitatorLensBar({
  courseId,
  lens,
  onLensChange,
}: {
  courseId: string;
  lens: FacilitatorLens;
  onLensChange: (lens: FacilitatorLens) => void;
}) {
  const ft = useForgeT();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);

  useEffect(() => {
    const load = () => {
      fetch(`/api/forge/courses/${courseId}/expedicion-v2/overview`)
        .then((r) => r.json())
        .then((d) => {
          setTeams(
            (d.teams ?? []).map((t: { roomId: string; name: string; playGroupId: string }) => ({
              roomId: t.roomId,
              name: t.name,
              playGroupId: t.playGroupId,
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

  const label =
    lens.kind === 'mine'
      ? ft('forge.v2.lensMine')
      : lens.kind === 'all'
        ? ft('forge.v2.lensAll')
        : lens.kind === 'team'
          ? lens.name
          : lens.name;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 px-2 py-1.5', EXPEDICION_FAC_TOOLBAR)}>
      <Eye className="h-3.5 w-3.5 text-[#2E5C9A] shrink-0" />
      <span className="text-[10px] font-bold text-[#145A45]/80 shrink-0">{ft('forge.v2.lensLabel')}</span>
      <select
        value={
          lens.kind === 'mine'
            ? 'mine'
            : lens.kind === 'all'
              ? 'all'
              : lens.kind === 'team'
                ? `team:${lens.roomId}`
                : `learner:${lens.userId}`
        }
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'mine') onLensChange({ kind: 'mine' });
          else if (v === 'all') onLensChange({ kind: 'all' });
          else if (v.startsWith('team:')) {
            const roomId = v.slice(5);
            const team = teams.find((t) => t.roomId === roomId);
            onLensChange({ kind: 'team', roomId, name: team?.name ?? roomId.slice(0, 8) });
          } else if (v.startsWith('learner:')) {
            const userId = v.slice(8);
            const learner = learners.find((l) => l.userId === userId);
            onLensChange({
              kind: 'learner',
              userId,
              name: learner?.name ?? userId.slice(0, 8),
            });
          }
        }}
        className="max-w-[140px] truncate rounded border border-[#145A45]/25 bg-[#F5F2EA] px-2 py-1 text-[10px] font-bold text-[#145A45]"
      >
        <option value="mine">{ft('forge.v2.lensMine')}</option>
        <option value="all">{ft('forge.v2.lensAll')}</option>
        {teams.length > 0 && (
          <optgroup label={ft('forge.v2.lensTeams')}>
            {teams.map((t) => (
              <option key={t.roomId} value={`team:${t.roomId}`}>
                {t.name}
              </option>
            ))}
          </optgroup>
        )}
        {learners.length > 0 && (
          <optgroup label={ft('forge.v2.lensLearners')}>
            {learners.map((l) => (
              <option key={l.userId} value={`learner:${l.userId}`}>
                {l.name ?? l.userId.slice(0, 8)}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <span
        className={cn(
          'hidden sm:inline text-[10px] font-semibold text-[#145A45]/70 truncate max-w-[100px]',
          lens.kind !== 'mine' && 'text-[#2E5C9A]'
        )}
      >
        {lens.kind === 'team' && <Users className="inline h-3 w-3 mr-0.5" />}
        {lens.kind === 'learner' && <User className="inline h-3 w-3 mr-0.5" />}
        {label}
      </span>
    </div>
  );
}
