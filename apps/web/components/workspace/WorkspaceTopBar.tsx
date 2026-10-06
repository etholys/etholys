'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, LayoutGrid, RefreshCw, Shield } from 'lucide-react';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { adminHref } from '@/lib/admin-control';

type Props = {
  locale: Locale;
  canManage: boolean;
  showCompanyLine?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  openSystemHref?: string | null;
  openSystemLabel?: string | null;
  /** Shortcut hint (Alt+Shift+W) */
  showShortcutHint?: boolean;
};

const copy = (locale: Locale) => ({
  hub: 'Hub',
  title:
    locale === 'pt' ? 'Centro integrado' : locale === 'es' ? 'Centro integrado' : 'Integrated workspace',
  refresh: locale === 'pt' ? 'Atualizar' : locale === 'es' ? 'Actualizar' : 'Refresh',
  admin: locale === 'pt' ? 'Administração' : locale === 'es' ? 'Administración' : 'Administration',
  manageAccess: locale === 'pt' ? 'Gerir acessos' : locale === 'es' ? 'Gestionar accesos' : 'Manage access',
  shortcut: 'Alt+Shift+W',
});

export function WorkspaceTopBar({
  locale,
  canManage,
  showCompanyLine,
  onRefresh,
  refreshing,
  openSystemHref,
  openSystemLabel,
  showShortcutHint,
}: Props) {
  const t = copy(locale);
  return (
    <header className="border-b border-[color:var(--sys-line,rgba(255,255,255,0.1))] bg-[color:var(--sys-aside-bg,rgba(7,17,26,0.55))] backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
          <Link
            href="/hub"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[color:var(--sys-muted,rgba(255,255,255,0.55))] transition hover:text-[color:var(--sys-ink,#E8EEF2)]"
          >
            <ArrowLeft className="h-4 w-4" /> {t.hub}
          </Link>
          <div className="hidden h-5 w-px bg-[color:var(--sys-line,rgba(255,255,255,0.1))] sm:block" />
          <h1 className="flex min-w-0 items-center gap-2 font-[family-name:var(--font-etholys-display)] text-lg font-semibold tracking-tight text-[color:var(--sys-ink,#E8EEF2)] sm:text-xl">
            <LayoutGrid className="h-5 w-5 shrink-0 text-teal-300" />
            <span className="truncate">{t.title}</span>
          </h1>
          {showShortcutHint ? (
            <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40 lg:inline">
              {t.shortcut}
            </kbd>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              {t.refresh}
            </button>
          ) : null}
          {openSystemHref && openSystemLabel ? (
            <Link
              href={openSystemHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-400/25 bg-teal-500/10 px-2.5 py-1.5 text-xs font-medium text-teal-200 transition hover:bg-teal-500/20"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {openSystemLabel}
            </Link>
          ) : null}
          {canManage ? (
            <Link
              href={adminHref('access')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white/55 transition hover:bg-white/5 hover:text-white"
            >
              <Shield className="h-3.5 w-3.5" />
              {t.manageAccess}
            </Link>
          ) : null}
        </div>
      </div>
      {showCompanyLine ? (
        <p className="mx-auto max-w-[1600px] border-t border-white/5 px-4 py-2 text-sm font-medium text-white/60 sm:px-6">
          {showCompanyLine}
        </p>
      ) : null}
    </header>
  );
}
