'use client';

import Link from 'next/link';
import { useApp } from '@/app/providers';
import { Layers, ArrowLeft } from 'lucide-react';

export default function EtholysAdminLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useApp();

  const back =
    locale === 'pt' ? 'Voltar ao Hub' : locale === 'es' ? 'Volver al Hub' : 'Back to Hub';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Etholys</p>
              <p className="text-sm font-semibold text-slate-900">
                {locale === 'pt' ? 'Administração' : locale === 'es' ? 'Administración' : 'Administration'}
              </p>
            </div>
          </div>
          <Link
            href="/hub"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            {back}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
