'use client';

import { useEffect, useState } from 'react';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { EXPEDICION_FAC_TOOLBAR } from '@/lib/forge/expedicion-v2/theme';
import { cn } from '@/lib/utils';

type TeamRow = {
  playGroupId: string;
  name: string;
  roomId: string;
  phase: string;
  cyclesCompleted: number;
  maxCycles: number;
  balance: number;
  postItCount: number;
  hasPendingMicroCaso?: boolean;
  hasPendingFeriaPitch?: boolean;
  feriaAwarded?: boolean;
  impactPoints?: number;
};

type LearnerRow = {
  userId: string;
  name: string | null;
  phase: string;
  balance: number;
  postItCount: number;
  finalScore?: number;
  impactPoints?: number;
};

export function ForgeFacilitatorV2Panel({ courseId }: { courseId: string }) {
  const ft = useForgeT();
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);

  useEffect(() => {
    if (!open) return;
    const load = () => {
      fetch(`/api/forge/courses/${courseId}/expedicion-v2/overview`)
        .then((r) => r.json())
        .then((d) => {
          setTeams(d.teams ?? []);
          setLearners(d.learners ?? []);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [courseId, open]);

  const phaseLabel = (p: string) => {
    const key = `forge.v2.phase.${p}`;
    const translated = ft(key);
    return translated === key ? p : translated;
  };

  return (
    <div className={cn('overflow-hidden', EXPEDICION_FAC_TOOLBAR)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-bold text-[#145A45] hover:bg-[#F5F2EA]"
      >
        <Users className="h-3.5 w-3.5 text-[#2E5C9A]" />
        {ft('forge.v2.panelTitle')}
        {open ? <ChevronUp className="ml-auto h-3 w-3" /> : <ChevronDown className="ml-auto h-3 w-3" />}
      </button>
      {open && (
        <div className="max-h-40 overflow-auto border-t border-[#145A45]/15 px-2 py-2 text-[10px]">
          {teams.length === 0 && learners.length === 0 && (
            <p className="text-[#145A45]/60 px-1">{ft('forge.v2.noData')}</p>
          )}
          {teams.map((t) => (
            <div key={t.roomId} className="mb-1.5 rounded-lg bg-[#E8F5F0] px-2 py-1.5">
              <p className="font-bold text-[#145A45]">{t.name}</p>
              <p className="text-[#1A3D5C]/90">
                {phaseLabel(t.phase)} ·{' '}
                {ft('forge.v2.cycle', {
                  current: Math.min(t.cyclesCompleted + 1, t.maxCycles),
                  max: t.maxCycles,
                })}{' '}
                · {ft('forge.v2.eco', { n: t.balance })} · {ft('forge.v2.postIts', { n: t.postItCount })}
                {(t.impactPoints ?? 0) > 0 && ` · ${ft('forge.v2.impact', { n: t.impactPoints ?? 0 })}`}
                {t.hasPendingMicroCaso && (
                  <span className="ml-1 text-[#C9A227]">· {ft('forge.v2.pendingMicroCaso')}</span>
                )}
                {t.hasPendingFeriaPitch && (
                  <span className="ml-1 text-[#2E5C9A]">· {ft('forge.v2.pendingFeriaPitch')}</span>
                )}
                {t.feriaAwarded && (
                  <span className="ml-1 text-[#5FAE4A]">· {ft('forge.v2.feriaAwarded')}</span>
                )}
              </p>
            </div>
          ))}
          {learners.length > 0 && teams.length > 0 && (
            <p className="mt-2 px-1 font-bold uppercase tracking-wide text-[#145A45]/50">
              {ft('forge.v2.individuals')}
            </p>
          )}
          {learners.slice(0, 8).map((l) => (
            <div key={l.userId} className="mb-1 rounded bg-[#F5F2EA] px-2 py-1">
              <span className="font-semibold text-[#145A45]">{l.name ?? l.userId.slice(0, 8)}</span>
              <span className="text-[#1A3D5C]/85">
                {' '}
                — {phaseLabel(l.phase)} · {ft('forge.v2.eco', { n: l.balance })}
                {(l.impactPoints ?? 0) > 0 && ` · ${ft('forge.v2.impact', { n: l.impactPoints ?? 0 })}`}
                {l.finalScore != null && ` · ${ft('forge.v2.score', { n: l.finalScore })}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
