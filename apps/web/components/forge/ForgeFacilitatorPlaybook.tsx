'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Coins, Layers, ListChecks } from 'lucide-react';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { useForgeT } from '@/lib/forge/use-forge-t';

type ModuleRow = {
  id: string;
  title: string;
  activities: { id: string; type: string; title: string }[];
};

type Props = {
  courseId: string;
  gameActivityId: string | null;
};

export function ForgeFacilitatorPlaybook({ courseId, gameActivityId }: Props) {
  const ft = useForgeT();
  const [spec, setSpec] = useState<GameSpecV1 | null>(null);
  const [modules, setModules] = useState<ModuleRow[]>([]);

  useEffect(() => {
    fetch(`/api/forge/courses/${courseId}`)
      .then((r) => r.json())
      .then((d) => setModules(d.course?.modules ?? []))
      .catch(() => {});
  }, [courseId]);

  useEffect(() => {
    if (!gameActivityId) return;
    fetch(`/api/forge/activities/${gameActivityId}`)
      .then((r) => r.json())
      .then(async (d) => {
        const specId = d.activity?.gameSpecId as string | undefined;
        if (!specId) return;
        const gs = await fetch(`/api/forge/game-specs/${specId}`).then((r) => r.json());
        setSpec((gs.gameSpec?.definition as GameSpecV1) ?? null);
      })
      .catch(() => {});
  }, [gameActivityId]);

  const quizzes = modules.flatMap((m) =>
    m.activities
      .filter((a) => a.type === 'quiz')
      .map((a) => ({ moduleTitle: m.title, ...a }))
  );

  const lessons = modules.flatMap((m) =>
    m.activities
      .filter((a) => a.type === 'lesson')
      .map((a) => ({ moduleTitle: m.title, ...a }))
  );

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
        <h2 className="flex items-center gap-2 font-black text-amber-950">
          <BookOpen className="h-5 w-5" />
          {ft('forge.playbook.title')}
        </h2>
        <p className="mt-2 text-amber-900">{ft('forge.playbook.intro')}</p>
        <ol className="mt-3 list-decimal list-inside space-y-1 text-amber-950">
          <li>{ft('forge.playbook.step1')}</li>
          <li>{ft('forge.playbook.step2')}</li>
          <li>{ft('forge.playbook.step3')}</li>
          <li>{ft('forge.playbook.step4')}</li>
          <li>{ft('forge.playbook.step5')}</li>
        </ol>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
        <h3 className="flex items-center gap-2 font-bold text-sky-900">
          <Coins className="h-4 w-4" />
          {ft('forge.playbook.bankTitle')}
        </h3>
        <ul className="mt-2 space-y-1 text-sky-950">
          <li>{ft('forge.playbook.bankStart')}</li>
          <li>{ft('forge.playbook.bankValidate')}</li>
          <li>{ft('forge.playbook.bankSkip')}</li>
          <li>{ft('forge.playbook.bankCards')}</li>
          <li>{ft('forge.playbook.bankFormula')}</li>
        </ul>
        <p className="mt-2 text-xs text-sky-800">{ft('forge.playbook.bankNote')}</p>
      </div>

      <div className="rounded-xl border border-violet-200 bg-white p-4">
        <h3 className="flex items-center gap-2 font-bold text-violet-900">
          <ListChecks className="h-4 w-4" />
          {ft('forge.playbook.quizzesTitle')}
        </h3>
        <p className="mt-1 text-xs text-slate-600">{ft('forge.playbook.quizzesHint')}</p>
        <ul className="mt-3 space-y-2">
          {quizzes.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <span>
                <span className="font-semibold text-slate-800">{q.title}</span>
                <span className="text-xs text-slate-500 block">{q.moduleTitle}</span>
              </span>
              <Link
                href={`/hub/forge/cursos/${courseId}/atividade/${q.id}`}
                className="text-xs font-bold text-violet-700 hover:underline"
              >
                {ft('forge.playbook.previewActivity')} →
              </Link>
            </li>
          ))}
        </ul>
        {lessons.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            {ft('forge.playbook.lessonsCount', { n: lessons.length })}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-emerald-200 bg-white p-4">
        <h3 className="flex items-center gap-2 font-bold text-emerald-900">
          <Layers className="h-4 w-4" />
          {ft('forge.playbook.cardsTitle', { n: spec?.cards?.length ?? 0 })}
        </h3>
        <p className="mt-1 text-xs text-slate-600">{ft('forge.playbook.cardsHint')}</p>
        {!spec?.cards?.length ? (
          <p className="mt-3 text-slate-500">{ft('forge.playbook.cardsEmpty')}</p>
        ) : (
          <ul className="mt-3 max-h-[420px] overflow-y-auto space-y-2">
            {spec.cards.map((c) => (
              <li key={c.id} className="rounded-lg border border-slate-100 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  {c.id} · {c.type ?? 'challenge'}
                </p>
                <p className="mt-1 font-semibold text-slate-900">{c.prompt}</p>
                {c.reflection && (
                  <p className="mt-1 text-xs text-emerald-800">💡 {c.reflection}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
        <p className="font-bold text-slate-900">{ft('forge.playbook.learnerViewTitle')}</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>{ft('forge.playbook.learner1')}</li>
          <li>{ft('forge.playbook.learner2')}</li>
          <li>{ft('forge.playbook.learner3')}</li>
        </ul>
        <p className="mt-3 text-amber-900">{ft('forge.playbook.gaps')}</p>
      </div>
    </div>
  );
}
