'use client';

import Link from 'next/link';
import { useForgeT } from '@/lib/forge/use-forge-t';

type Props = {
  ok: boolean;
  inDocker: boolean;
  webRoot: string;
  cwd: string;
  forgeCourseCount: number;
  forgeDelegates: string[];
  error: string | null;
};

export function ForgeDiagnosticoPanel({ ok, forgeCourseCount, error }: Props) {
  const ft = useForgeT();
  const displayError =
    error?.includes('forgeCourse') && error.includes('delegate')
      ? ft('forge.diagnostico.prismaMissing')
      : error;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link href="/hub/forge" className="text-sm text-violet-600 hover:underline">
        ← {ft('forge.diagnostico.back')}
      </Link>
      <h1 className="mt-4 text-2xl font-black text-slate-900">{ft('forge.diagnostico.title')}</h1>
      <p className="mt-2 text-sm text-slate-500">{ft('forge.diagnostico.subtitle')}</p>
      <div
        className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
          ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
        }`}
      >
        {ok
          ? `${forgeCourseCount} ${ft('forge.dashboard.stat.published').toLowerCase()}.`
          : displayError || ft('forge.diagnostico.prismaMissing')}
      </div>
    </div>
  );
}
