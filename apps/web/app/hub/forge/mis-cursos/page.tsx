'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ForgeAccessContext } from '@/lib/forge/access-context-shared';
import { GraduationCap, Route } from 'lucide-react';
import type { MyProgram } from '@/lib/forge/my-programs-types';
import { useForgeT } from '@/lib/forge/use-forge-t';

export default function ForgeMisCursosPage() {
  const ft = useForgeT();
  const [ctx, setCtx] = useState<ForgeAccessContext | null>(null);
  const [programs, setPrograms] = useState<MyProgram[]>([]);

  useEffect(() => {
    fetch('/api/forge/access-context')
      .then((r) => r.json())
      .then((d) => setCtx(d))
      .catch(() => {});
    fetch('/api/forge/my-programs')
      .then((r) => r.json())
      .then((d) => setPrograms(d.programs ?? []))
      .catch(() => {});
  }, []);

  if (!ctx) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-black text-slate-900">{ft('forge.mycourses.title')}</h1>
        <p className="mt-2 text-sm text-slate-600">{ft('forge.mycourses.subtitle')}</p>
      </div>

      {programs.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-violet-800">
            <Route className="h-4 w-4" />
            {ft('forge.mycourses.trail')}
          </h2>
          {programs.map((p) => (
            <div key={p.id} className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
              <p className="font-bold text-slate-900">{p.title}</p>
              {p.description && <p className="text-xs text-slate-600 mt-1">{p.description}</p>}
              <p className="text-sm text-violet-800 mt-2 font-semibold">
                {p.overallProgress}% {ft('forge.mycourses.trailProgress')}
              </p>
              <ul className="mt-3 space-y-2">
                {p.courses.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/hub/forge/cursos/${c.id}`}
                      className="flex items-center gap-2 text-sm text-slate-800 hover:text-violet-700"
                    >
                      <span>{c.coverEmoji}</span>
                      <span className="flex-1">{c.title}</span>
                      <span className="text-xs text-slate-500">{c.progressPercent}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {ctx.courses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {ft('forge.mycourses.empty')}
        </p>
      ) : (
        <ul className="space-y-3">
          {ctx.courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/hub/forge/cursos/${c.id}`}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition"
              >
                <span className="text-4xl">{c.coverEmoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">{c.title}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {c.progressPercent}% {ft('forge.mycourses.completed')}
                  </p>
                </div>
                <GraduationCap className="h-6 w-6 text-blue-600 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
