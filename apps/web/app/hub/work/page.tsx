'use client';

import Link from 'next/link';
import { ArrowLeft, CheckSquare, Layers } from 'lucide-react';
import { useApp } from '@/app/providers';
import TasksBoard from '@/components/work/TasksBoard';

export default function HubWorkPage() {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/40">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/hub"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Hub</span>
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-700 text-white shadow-sm">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold text-slate-900">Etholys Work</h1>
                <span className="hidden rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-800 sm:inline">
                  Etholys Tools
                </span>
              </div>
              <p className="truncate text-xs text-slate-500">
                {t(
                  'Tarefas da equipa — mesmo motor que ATLAS e SIEP',
                  'Tareas del equipo — mismo motor que ATLAS y SIEP',
                  'Team tasks — same engine as ATLAS and SIEP',
                )}
              </p>
            </div>
          </div>
          <Link
            href="/hub"
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 sm:inline-flex"
          >
            <Layers className="h-3.5 w-3.5" />
            Etholys Tools
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <TasksBoard variant="hub" />
      </main>
    </div>
  );
}
