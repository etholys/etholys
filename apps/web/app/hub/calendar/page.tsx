'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, Link2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { AppearanceToggle } from '@/components/hub/AppearanceToggle';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { ECalendar } from '@/components/calendar/ECalendar';
import ChorusAgendaOrganizer from '@/components/meet/ChorusAgendaOrganizer';
import { sysTheme } from '@/lib/system-shell';
import { cn } from '@/lib/utils';

function CalendarBody() {
  const { locale, activeCompanyId } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const router = useRouter();
  const params = useSearchParams();
  const pane = params.get('view') === 'agenda' ? 'agenda' : 'calendar';

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
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-[color:var(--sys-line)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => router.replace('/hub/calendar')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium',
                  pane === 'calendar' ? 'bg-[color:var(--sys-nav-hover)] text-[color:var(--sys-ink)]' : 'text-[color:var(--sys-nav-idle)]',
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {t('Calendário', 'Calendario', 'Calendar')}
              </button>
              <button
                type="button"
                onClick={() => router.replace('/hub/calendar?view=agenda')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium',
                  pane === 'agenda' ? 'bg-[color:var(--sys-nav-hover)] text-[color:var(--sys-ink)]' : 'text-[color:var(--sys-nav-idle)]',
                )}
              >
                <Link2 className="h-3.5 w-3.5" />
                {t('Agenda pública', 'Agenda pública', 'Public agenda')}
              </button>
            </div>
            <AppearanceToggle collapsed />
          </div>
        </div>
      </header>
      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-auto">
        {pane === 'agenda' ? (
          <ChorusAgendaOrganizer surface="calendar" lockedCompanyId={activeCompanyId || undefined} />
        ) : (
          <ECalendar />
        )}
      </main>
    </div>
  );
}

export default function HubCalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarBody />
    </Suspense>
  );
}
