'use client';

import { useState } from 'react';
import { getMaturityQuiz } from '@/lib/forge/expedicion-v2/content';
import { useForgeT } from '@/lib/forge/use-forge-t';

type Q = {
  id: string;
  text: string;
  type: 'text' | 'choice';
  options?: string[];
  correctIndex?: number;
};

export function ForgeMaturityQuizGate({
  side,
  onComplete,
}: {
  side: 'pre' | 'post';
  onComplete: (answers: Record<string, string>) => void;
}) {
  const ft = useForgeT();
  const quiz = getMaturityQuiz();
  const questions = (side === 'pre' ? quiz.pre : quiz.post) as Q[];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');

  const submit = () => {
    onComplete({ ...answers, _name: name, _business: business });
  };

  const allAnswered = questions.every((q) => answers[q.id]?.trim());

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1B5E4B]/90 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-[#F7F3EB] p-6 shadow-2xl">
        <h2 className="text-xl font-black text-[#1B5E4B]">
          {ft('forge.v2.maturityQuiz', {
            side: side === 'pre' ? ft('forge.v2.maturityFront') : ft('forge.v2.maturityBack'),
          })}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {side === 'pre' ? ft('forge.v2.quizPreHint') : ft('forge.v2.quizPostHint')}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={ft('forge.v2.expeditionerName')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder={ft('forge.v2.businessIdea')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-6 space-y-5">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">
                {i + 1}. {q.text}
              </p>
              {q.type === 'text' ? (
                <textarea
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              ) : (
                <div className="mt-2 space-y-2">
                  {(q.options ?? []).map((opt, oi) => (
                    <label key={oi} className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === String(oi)}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: String(oi) }))}
                        className="mt-1"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={!allAnswered}
          onClick={submit}
          className="mt-6 w-full rounded-xl bg-[#1B5E4B] py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {side === 'pre' ? ft('forge.v2.enterExpedition') : ft('forge.v2.viewFinalScore')}
        </button>
      </div>
    </div>
  );
}
