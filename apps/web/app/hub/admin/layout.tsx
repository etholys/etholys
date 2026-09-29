'use client';

import Link from 'next/link';
import { useApp } from '@/app/providers';
import { Layers, ArrowLeft } from 'lucide-react';
import { AdminAccessGuard } from '@/components/hub/AdminAccessGuard';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { sysTheme } from '@/lib/system-shell';
import { cn } from '@/lib/utils';

export default function EtholysAdminLayout({ children }: { children: React.ReactNode }) {
  const { locale, activeCompanyId } = useApp();

  const back =
    locale === 'pt' ? 'Voltar ao Hub' : locale === 'es' ? 'Volver al Hub' : 'Back to Hub';

  return (
    <div className={sysTheme.root} data-accent="teal">
      <SystemAtmosphere accent="teal" />
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07111A]/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border',
                  sysTheme.icon.teal,
                )}
              >
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className={cn(sysTheme.brand, 'tracking-[0.12em]')}>ETHOLYS</p>
                <p className="text-sm font-medium text-white/80">
                  {locale === 'pt'
                    ? 'Administração'
                    : locale === 'es'
                      ? 'Administración'
                      : 'Administration'}
                </p>
              </div>
            </div>
            <Link
              href="/hub"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {back}
            </Link>
          </div>
        </header>
        <main className="sys-canvas mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
          <AdminAccessGuard companyId={activeCompanyId}>{children}</AdminAccessGuard>
        </main>
      </div>
    </div>
  );
}
