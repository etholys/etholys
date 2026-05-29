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
  hub: locale === 'es' ? 'Hub' : locale === 'en' ? 'Hub' : 'Hub',
  title:
    locale === 'pt' ? 'Centro integrado' : locale === 'es' ? 'Centro integrado' : 'Integrated workspace',
  overview: locale === 'pt' ? 'Visão geral' : locale === 'es' ? 'Vista general' : 'Overview',
  team: locale === 'pt' ? 'Equipa' : locale === 'es' ? 'Equipo' : 'Team',
  manage: locale === 'pt' ? 'Gerir acessos' : locale === 'es' ? 'Gestionar accesos' : 'Manage access',
});

export function WorkspaceTopBar({ locale, canManage, active, showCompanyLine }: Props) {
  const t = copy(locale);
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
          <Link
            href="/hub"
            className="inline-flex shrink-0 items-center gap-1 text-sm text-slate-600 hover:text-teal-700"
          >
            <ArrowLeft className="h-4 w-4" /> {t.hub}
          </Link>
          <h1 className="flex min-w-0 items-center gap-2 text-lg font-bold text-slate-900 sm:text-xl">
            <LayoutGrid className="h-6 w-6 shrink-0 text-teal-600" />
            <span className="truncate">{t.title}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
            <Link
              href="/hub/workspace"
              className={
                active === 'main'
                  ? 'rounded-md bg-white px-3 py-1.5 font-medium text-slate-900 shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-slate-600 hover:text-slate-900'
              }
            >
              {t.overview}
            </Link>
            {canManage && (
              <Link
                href="/hub/workspace/team"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium',
                  active === 'team'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <Users className="h-3.5 w-3.5" />
                {t.team}
              </Link>
            )}
          </nav>
          {canManage && active === 'main' && (
            <Link
              href="/hub/workspace/team"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t.manage}
            </Link>
          )}
        </div>
      </div>
      {showCompanyLine && (
        <p className="mx-auto mt-2 max-w-6xl text-sm text-slate-500">{showCompanyLine}</p>
      )}
    </header>
  );
}
