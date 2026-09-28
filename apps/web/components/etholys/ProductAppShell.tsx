'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useApp } from '@/app/providers';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { SystemLicenseGate } from '@/components/hub/SystemLicenseGate';
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
  const { locale } = useApp();
  const { status } = useSession();
  const meta = ETHOLYS_PRODUCTS[product];
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';

  if (status === 'loading' || status === 'unauthenticated') {
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
            <p className="mt-1 text-[11px] leading-snug text-white/45">{meta.tagline[loc]}</p>
            <Link href="/hub" className="mt-3 block text-[11px] text-white/40 hover:text-white">
              {loc === 'es' ? 'Volver al Hub' : loc === 'en' ? 'Back to Hub' : 'Voltar ao Hub'}
            </Link>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {nav.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
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
            })}
          </nav>
        </aside>
        <main className="sys-canvas ml-60 min-h-screen flex-1 overflow-auto p-6">{children}</main>
      </div>
    </SystemLicenseGate>
  );
}
