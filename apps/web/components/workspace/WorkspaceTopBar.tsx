'use client';

import Link from 'next/link';
import { ArrowLeft, LayoutGrid, Users } from 'lucide-react';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type NavKey = 'main' | 'team';

type Props = {
  locale: Locale;
  canManage: boolean;
  active: NavKey;
  showCompanyLine?: string | null;
};

const copy = (locale: Locale) => ({
  hub: 'Hub',
  title:
    locale === 'pt' ? 'Centro integrado' : locale === 'es' ? 'Centro integrado' : 'Integrated workspace',
  overview: locale === 'pt' ? 'Visão geral' : locale === 'es' ? 'Vista general' : 'Overview',
  team: locale === 'pt' ? 'Equipa' : locale === 'es' ? 'Equipo' : 'Team',
});

export function WorkspaceTopBar({ locale, canManage, active, showCompanyLine }: Props) {
  const t = copy(locale);
  return (
    <header className="border-b border-slate-200/90 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
          <Link
            href="/hub"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-slate-600 hover:text-teal-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t.hub}
          </Link>
          <div className="hidden h-5 w-px bg-slate-200 sm:block" />
          <h1 className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            <LayoutGrid className="h-5 w-5 shrink-0 text-teal-700" />
            <span className="truncate">{t.title}</span>
          </h1>
        </div>
        <nav
          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-sm"
          aria-label={t.title}
        >
          <Link
            href="/hub/workspace"
            className={cn(
              'rounded-md px-3.5 py-1.5 font-medium transition',
              active === 'main'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {t.overview}
          </Link>
          {canManage && (
            <Link
              href="/hub/workspace/team"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition',
                active === 'team'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <Users className="h-3.5 w-3.5" />
              {t.team}
            </Link>
          )}
        </nav>
      </div>
      {showCompanyLine ? (
        <p className="mx-auto max-w-6xl border-t border-slate-100 px-4 py-2 text-sm font-medium text-slate-700 sm:px-6">
          {showCompanyLine}
        </p>
      ) : null}
    </header>
  );
}
