'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckSquare, Settings } from 'lucide-react';
import { useApp } from '@/app/providers';
import { AppearanceToggle } from '@/components/hub/AppearanceToggle';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { sysTheme } from '@/lib/system-shell';
import { cn } from '@/lib/utils';
import WorkShell from '@/components/work/WorkShell';

export default function HubWorkPage() {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  return (
    <div className={cn(sysTheme.root, 'etholys-etask min-h-screen flex-col')} data-accent="teal">
      <SystemAtmosphere accent="teal" />
      <header className="relative z-30 shrink-0 border-b border-[color:var(--sys-line)] bg-[color:var(--sys-aside-bg)] backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/hub"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[color:var(--sys-nav-idle)] hover:bg-[color:var(--sys-nav-hover)] hover:text-[color:var(--sys-ink)]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Hub</span>
            </Link>
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', sysTheme.icon.teal)}>
              <CheckSquare className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className={sysTheme.brand}>eTask</h1>
              <p className="truncate text-[11px] text-[color:var(--sys-faint,#94a3b8)]">Etholys Task</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <AppearanceToggle collapsed />
          <Link
            href="/hub/work/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--sys-line)] px-2.5 py-1.5 text-xs text-[color:var(--sys-nav-idle)] hover:bg-[color:var(--sys-nav-hover)] hover:text-[color:var(--sys-ink)]"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('Definições', 'Ajustes', 'Settings')}</span>
          </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-3 py-4 sm:px-5">
        <Suspense
          fallback={
            <div className="flex justify-center py-24">
              <div className={cn('h-8 w-8 animate-spin rounded-full border-2', sysTheme.spin.teal)} />
            </div>
          }
        >
          <WorkShell />
        </Suspense>
      </main>
    </div>
  );
}
