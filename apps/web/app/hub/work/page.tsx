'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckSquare, Layers, Settings } from 'lucide-react';
import { useApp } from '@/app/providers';
import WorkShell from '@/components/work/WorkShell';

export default function HubWorkPage() {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-50 via-slate-50 to-white">
      <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
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
                <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">Etholys Work</h1>
                <span className="hidden rounded-md bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-800 sm:inline">
                  Etholys Tools
                </span>
              </div>
              <p className="truncate text-xs text-slate-500">
                {t(
                  'Criação rápida, vistas e pastas partilhadas',
                  'Creación rápida, vistas y carpetas compartidas',
                  'Quick add, views and shared folders',
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/hub/work/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('Definições', 'Ajustes', 'Settings')}</span>
            </Link>
            <Link
              href="/hub"
              className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 sm:inline-flex"
            >
              <Layers className="h-3.5 w-3.5" />
              Etholys Tools
            </Link>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-3 py-4 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="flex justify-center py-24">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600/30 border-t-cyan-600" />
            </div>
          }
        >
          <WorkShell />
        </Suspense>
      </main>
    </div>
  );
}
