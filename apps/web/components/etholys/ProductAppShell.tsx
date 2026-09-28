'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useApp } from '@/app/providers';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { SystemLicenseGate } from '@/components/hub/SystemLicenseGate';
import { CompanyPicker } from '@/components/hub/CompanyPicker';
import { useEnsureActiveCompany } from '@/hooks/useEnsureActiveCompany';
import { cn } from '@/lib/utils';
import { sysTheme } from '@/lib/system-shell';
import { ETHOLYS_PRODUCTS, type EtholysProductId } from '@/lib/etholys-products';

type Nav = { href: string; label: string };

export function ProductAppShell({
  product,
  accent,
  nav,
  children,
}: {
  product: EtholysProductId;
  accent: 'teal' | 'indigo' | 'amber' | 'violet';
  nav: Nav[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { locale, activeCompanyId, setActiveCompanyId } = useApp();
  const { status } = useSession();
  const { companies, companiesReady, companiesLoadError, reloadCompanies, companyId: ensuredId } =
    useEnsureActiveCompany();
  const meta = ETHOLYS_PRODUCTS[product];
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = ensuredId || (activeCompanyId ? String(activeCompanyId) : '');
  const hydrated = useRef(false);

  useEffect(() => {
    if (!companiesReady || !companyId || hydrated.current) return;
    if (product === 'polaris') return;
    hydrated.current = true;
    void fetch(`/api/business-dossier?companyId=${encodeURIComponent(companyId)}&hydrateAll=1`, {
      cache: 'no-store',
    }).catch(() => {});
  }, [companiesReady, companyId, product]);

  if (status === 'loading' || status === 'unauthenticated' || !companiesReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111A]">
        <div className={cn('h-8 w-8 animate-spin rounded-full border-2', sysTheme.spin[accent])} />
      </div>
    );
  }

  return (
    <SystemLicenseGate system="NEXUS">
      <div className={sysTheme.root} data-accent={accent}>
        <SystemAtmosphere accent={accent} />
        <aside className={cn(sysTheme.aside, 'w-60 translate-x-0')}>
          <div className="border-b border-white/10 p-4">
            <p className={sysTheme.brand}>{meta.name}</p>
            {meta.tagline[loc] ? (
              <p className="mt-1 text-[11px] leading-snug text-white/45">{meta.tagline[loc]}</p>
            ) : null}
            <div className="mt-3">
              <CompanyPicker
                companies={companies}
                activeCompanyId={companyId}
                onSelect={setActiveCompanyId}
                ready={companiesReady}
                error={companiesLoadError}
                onRetry={() => void reloadCompanies()}
                locale={loc}
                compact
                className="w-full border-white/15 bg-white/5 text-white"
              />
            </div>
            <Link href="/hub" className="mt-3 block text-[11px] text-white/40 hover:text-white">
              {loc === 'es' ? 'Volver al Hub' : loc === 'en' ? 'Back to Hub' : 'Voltar ao Hub'}
            </Link>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {(() => {
              const match = nav
                .filter((n) => pathname === n.href || pathname?.startsWith(`${n.href}/`))
                .sort((a, b) => b.href.length - a.href.length)[0];
              return nav.map((item) => {
              const active = match?.href === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-sm',
                    active ? sysTheme.active[accent] : 'text-white/60 hover:bg-white/5 hover:text-white'
                  )}
                >
                  {item.label}
                </Link>
              );
              });
            })()}
          </nav>
        </aside>
        <main className="sys-canvas relative z-10 ml-60 min-h-screen min-w-0 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </SystemLicenseGate>
  );
}
