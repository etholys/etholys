'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { Route, Plus } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';

type Program = {
  id: string;
  title: string;
  description?: string | null;
  courses: { id: string; title: string; status: string; coverEmoji: string }[];
};

export default function ForgeTrilhasPage() {
  const ft = useForgeT();
  const { activeCompanyId } = useApp();
  const [programs, setPrograms] = useState<Program[]>([]);

  const load = useCallback(() => {
    const q = activeCompanyId ? `?companyId=${encodeURIComponent(activeCompanyId)}` : '';
    fetch(`/api/forge/programs${q}`)
      .then((r) => r.json())
      .then((d) => setPrograms(d.programs ?? []));
  }, [activeCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function createProgram() {
    const title = window.prompt(ft('forge.trails.prompt'));
    if (!title?.trim()) return;
    await fetch('/api/forge/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: activeCompanyId, title: title.trim() }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Route className="h-7 w-7 text-violet-600" />
            {ft('forge.trails.title')}
          </h1>
          <p className="text-sm text-slate-500">{ft('forge.trails.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={createProgram}
          className="flex items-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> {ft('forge.trails.new')}
        </button>
      </div>

      {programs.length === 0 && (
        <p className="text-sm text-slate-500">{ft('forge.trails.empty')}</p>
      )}

      <div className="space-y-4">
        {programs.map((p) => (
          <div key={p.id} className="rounded-xl border bg-white p-5">
            <Link href={`/hub/forge/trilhas/${p.id}`} className="font-bold text-slate-900 hover:text-violet-700">
              {p.title}
            </Link>
            {p.description && <p className="mt-1 text-sm text-slate-600">{p.description}</p>}
            <ul className="mt-3 flex flex-wrap gap-2">
              {p.courses.map((c) => (
                <Link
                  key={c.id}
                  href={`/hub/forge/cursos/${c.id}`}
                  className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-1.5 text-sm hover:border-violet-300"
                >
                  {c.coverEmoji} {c.title}
                </Link>
              ))}
              {p.courses.length === 0 && (
                <span className="text-xs text-slate-400">Sem cursos ligados — defina programId ao criar curso</span>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
