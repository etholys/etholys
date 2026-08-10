'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Loader2, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActiveCompanyOption } from '@/hooks/useEnsureActiveCompany';

type Props = {
  companies: ActiveCompanyOption[];
  activeCompanyId: string;
  onSelect: (id: string) => void;
  ready?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
  /** pt | es | en */
  locale?: string;
};

export function CompanyPicker({
  companies,
  activeCompanyId,
  onSelect,
  ready = true,
  error = null,
  onRetry,
  className,
  compact,
  locale = 'es',
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const active = companies.find((c) => c.id === activeCompanyId);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'en' ? en : es;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open]);

  if (!ready) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-500',
          className,
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">{t('Empresa…', 'Empresa…', 'Company…')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <button
        type="button"
        onClick={() => onRetry?.()}
        className={cn(
          'inline-flex touch-manipulation items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-medium text-red-800',
          className,
        )}
        title={error}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {t('Repetir', 'Reintentar', 'Retry')}
      </button>
    );
  }

  if (companies.length === 0) {
    return (
      <Link
        href="/onboarding"
        className={cn(
          'inline-flex touch-manipulation items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-900',
          className,
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        {t('Criar empresa', 'Crear empresa', 'Create company')}
      </Link>
    );
  }

  if (companies.length === 1) {
    return (
      <button
        type="button"
        onClick={() => onSelect(companies[0]!.id)}
        className={cn(
          'inline-flex min-w-0 max-w-[10rem] touch-manipulation items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 sm:max-w-[14rem]',
          compact && 'py-1',
          className,
        )}
        title={active?.shortName || companies[0]!.shortName}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="truncate">{active?.shortName || companies[0]!.shortName}</span>
      </button>
    );
  }

  return (
    <div ref={ref} className={cn('relative min-w-0', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full max-w-[11rem] touch-manipulation items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left text-xs font-medium text-slate-800 hover:border-sky-200 hover:bg-white sm:max-w-[14rem] sm:py-1.5',
          compact && 'py-1.5',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <span className="truncate">
            {active?.shortName || t('Escolher empresa', 'Elegir empresa', 'Choose company')}
          </span>
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/30 sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="listbox"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[50vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:right-0 sm:top-full sm:mt-1 sm:max-h-64 sm:rounded-lg sm:pb-1 sm:shadow-lg"
          >
            <div className="mb-1 flex justify-center sm:hidden">
              <span className="h-1 w-10 rounded-full bg-slate-200" />
            </div>
            <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:hidden">
              {t('Empresa ativa', 'Empresa activa', 'Active company')}
            </p>
            {companies.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={c.id === activeCompanyId}
                onClick={() => {
                  onSelect(c.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full touch-manipulation items-center gap-2 px-4 py-3.5 text-left text-sm hover:bg-slate-50 sm:px-3 sm:py-2',
                  c.id === activeCompanyId && 'bg-sky-50 font-medium text-sky-900',
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color || '#0ea5e9' }}
                />
                <span className="truncate">{c.shortName}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
