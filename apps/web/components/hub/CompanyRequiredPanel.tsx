'use client';

import Link from 'next/link';
import { Building2, Loader2, Plus, RefreshCw } from 'lucide-react';
import type { ActiveCompanyOption } from '@/hooks/useEnsureActiveCompany';

type Props = {
  locale: string;
  companies: ActiveCompanyOption[];
  ready: boolean;
  error: string | null;
  httpStatus?: number | null;
  activeCompanyId: string;
  onSelect: (id: string) => void;
  onRetry: () => void;
};

/** Painel obrigatório quando não há empresa — nunca esconde a ação. */
export function CompanyRequiredPanel({
  locale,
  companies,
  ready,
  error,
  httpStatus,
  activeCompanyId,
  onSelect,
  onRetry,
}: Props) {
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'en' ? en : es;

  return (
    <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200/80">
          <Building2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {t('Escolha a empresa para continuar', 'Elige la empresa para continuar', 'Choose a company to continue')}
          </p>
          <p className="mt-1 text-xs text-amber-900/80">
            {t(
              'Sem empresa ativa o Meet não consegue criar reuniões.',
              'Sin empresa activa Meet no puede crear reuniones.',
              'Without an active company Meet cannot create meetings.',
            )}
          </p>

          {!ready && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('A carregar empresas…', 'Cargando empresas…', 'Loading companies…')}
            </p>
          )}

          {ready && error && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-red-800">
                {error}
                {httpStatus ? ` (${httpStatus})` : ''}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex touch-manipulation items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 ring-1 ring-amber-300"
              >
                <RefreshCw className="h-4 w-4" />
                {t('Tentar outra vez', 'Intentar de nuevo', 'Try again')}
              </button>
            </div>
          )}

          {ready && !error && companies.length === 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm">
                {t(
                  'A sua conta ainda não está ligada a nenhuma empresa.',
                  'Tu cuenta aún no está vinculada a ninguna empresa.',
                  'Your account is not linked to any company yet.',
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/onboarding"
                  className="inline-flex touch-manipulation items-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  {t('Criar ou entrar', 'Crear o unirse', 'Create or join')}
                </Link>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex touch-manipulation items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 ring-1 ring-amber-300"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t('Recarregar', 'Recargar', 'Reload')}
                </button>
              </div>
            </div>
          )}

          {ready && !error && companies.length > 0 && (
            <div className="mt-3 grid gap-2">
              {companies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={`flex w-full touch-manipulation items-center gap-3 rounded-xl border bg-white px-3 py-3 text-left text-sm font-medium shadow-sm ${
                    c.id === activeCompanyId
                      ? 'border-sky-400 ring-2 ring-sky-200'
                      : 'border-amber-200'
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color || '#0ea5e9' }}
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-900">{c.shortName}</span>
                  {c.id === activeCompanyId && (
                    <span className="text-xs font-semibold text-sky-700">
                      {t('Ativa', 'Activa', 'Active')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
