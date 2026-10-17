'use client';

import Link from 'next/link';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { useApp } from '@/app/providers';
import { AppearanceToggle } from '@/components/hub/AppearanceToggle';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { ECalendar } from '@/components/calendar/ECalendar';
import { sysTheme } from '@/lib/system-shell';
import { cn } from '@/lib/utils';

export default function HubCalendarPage() {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  return (
    <div className={cn(sysTheme.root, 'flex min-h-screen flex-col')} data-accent="indigo">
      <SystemAtmosphere accent="indigo" />
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
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', sysTheme.icon.indigo)}>
              <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className={sysTheme.brand}>eCalendar</h1>
              <p className="truncate text-[11px] text-[color:var(--sys-faint,#94a3b8)]">
                {t('Calendário da empresa', 'Calendario de la empresa', 'Company calendar')}
              </p>
            </div>
          </div>
          <AppearanceToggle collapsed />
        </div>
      </header>
      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        <ECalendar />
      </main>
    </div>
  );
}
