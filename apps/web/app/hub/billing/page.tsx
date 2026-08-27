'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useApp } from '@/app/providers';
import { AdminAccessGuard } from '@/components/hub/AdminAccessGuard';
import { BillingConsole } from '@/components/etholys-admin/BillingConsole';
import { ArrowLeft, CreditCard } from 'lucide-react';

export default function HubBillingPage() {
  const { locale, activeCompanyId } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-700">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Etholys</p>
              <p className="text-sm font-semibold text-slate-900">
                {t('Licenças e pagamentos', 'Licencias y pagos', 'Licensing & billing')}
              </p>
            </div>
          </div>
          <Link
            href="/hub/admin"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Administração', 'Administración', 'Admin')}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <AdminAccessGuard companyId={activeCompanyId}>
          {!activeCompanyId ? (
            <p className="text-sm text-slate-500">{t('Selecione uma empresa.', 'Seleccione una empresa.', 'Select a company.')}</p>
          ) : (
            <Suspense
              fallback={
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              }
            >
              <BillingConsole companyId={activeCompanyId} />
            </Suspense>
          )}
        </AdminAccessGuard>
      </main>
    </div>
  );
}
