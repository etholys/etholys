'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  ChevronDown,
  Compass,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  Sunrise,
  X,
  LogOut,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { SystemLicenseGate } from '@/components/hub/SystemLicenseGate';
import { CompanyPicker } from '@/components/hub/CompanyPicker';
import { AppearanceToggle } from '@/components/hub/AppearanceToggle';
import { useEnsureActiveCompany } from '@/hooks/useEnsureActiveCompany';
import { cn, getInitials } from '@/lib/utils';
import { sysTheme, type SystemAccent } from '@/lib/system-shell';
import { ETHOLYS_PRODUCTS, type EtholysProductId } from '@/lib/etholys-products';

type Nav = { href: string; label: string; requiresAttended?: boolean };

const PRODUCT_ICON = {
  aurora: Sunrise,
  polaris: Compass,
  radar: Radar,
} as const;

export function ProductAppShell({
  product,
  accent,
  nav,
  children,
  sidebarAfterCompany,
  resolveNavHref,
}: {
  product: EtholysProductId;
  accent: SystemAccent;
  nav: Nav[];
  children: ReactNode;
  /** Conteúdo extra sob o seletor global de empresa (ex.: negócio atendido AURORA). */
  sidebarAfterCompany?: ReactNode;
  resolveNavHref?: (item: Nav) => string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, activeCompanyId, setActiveCompanyId } = useApp();
  const { data: session, status } = useSession();
  const { companies, companiesReady, companiesLoadError, reloadCompanies, companyId: ensuredId } =
    useEnsureActiveCompany();
  const meta = ETHOLYS_PRODUCTS[product];
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const companyId = ensuredId || (activeCompanyId ? String(activeCompanyId) : '');
  const hydrated = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const Icon = PRODUCT_ICON[product];

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (!companiesReady || !companyId || hydrated.current) return;
    // AURORA atende negócios externos — não hidratar o dossiê da incubadora.
    if (product === 'aurora' || product === 'polaris') return;
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

  const match = nav
    .filter((n) => pathname === n.href || pathname?.startsWith(`${n.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <SystemLicenseGate system="NEXUS">
      <div className={sysTheme.root} data-accent={accent}>
        <SystemAtmosphere accent={accent} />

        <aside
          className={cn(
            sysTheme.aside,
            collapsed ? 'w-16' : 'w-64',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          <div className={cn('flex-shrink-0 border-b border-white/10', collapsed ? 'p-2' : 'p-4')}>
            <div className="flex items-center justify-between">
              <Link href={meta.href} className="flex min-w-0 items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border',
                    sysTheme.icon[accent]
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                {!collapsed && <span className={cn('truncate', sysTheme.brand)}>{meta.name}</span>}
              </Link>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCollapsed(!collapsed)}
                  className="hidden items-center justify-center rounded-lg p-1.5 text-white/35 transition hover:bg-white/5 hover:text-white lg:flex"
                  title={collapsed ? 'Expandir' : 'Minimizar'}
                >
                  {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="text-white/40 hover:text-white lg:hidden"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {!collapsed && (
              <>
                {meta.tagline[loc] ? (
                  <p className="mt-2 text-[11px] leading-snug text-white/45">{meta.tagline[loc]}</p>
                ) : null}
                <Link
                  href="/hub"
                  className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/40 transition hover:bg-white/5 hover:text-white"
                >
                  <ChevronDown className="h-3 w-3 rotate-90" />
                  {loc === 'es' ? 'Volver al Hub' : loc === 'en' ? 'Back to Hub' : 'Voltar ao Hub'}
                </Link>
              </>
            )}
          </div>

          {!collapsed && (
            <div className="flex-shrink-0 space-y-3 border-b border-white/10 p-3">
              <CompanyPicker
                companies={companies}
                activeCompanyId={companyId}
                onSelect={setActiveCompanyId}
                ready={companiesReady}
                error={companiesLoadError}
                onRetry={() => void reloadCompanies()}
                locale={loc}
                compact
                tone="dark"
                className="w-full"
              />
              {sidebarAfterCompany}
            </div>
          )}

          <nav className={cn('flex-1 space-y-0.5 overflow-y-auto', collapsed ? 'p-1.5' : 'p-3')}>
            {nav.map((item) => {
              const href = resolveNavHref ? resolveNavHref(item) : item.href;
              const active = match?.href === item.href;
              return (
                <Link
                  key={item.href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center rounded-lg text-sm font-medium transition',
                    collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                    active ? sysTheme.active[accent] : sysTheme.navIdle
                  )}
                >
                  {!collapsed && item.label}
                  {collapsed && <span className="text-[10px] font-semibold uppercase">{item.label.slice(0, 2)}</span>}
                </Link>
              );
            })}
          </nav>

          <div className={cn('flex-shrink-0 border-t border-white/10', collapsed ? 'p-1.5' : 'p-3')}>
            <AppearanceToggle collapsed={collapsed} className="mb-1" />
            {!collapsed ? (
              <div className="flex items-center gap-3 px-3 py-2">
                <div
                  className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    sysTheme.avatar[accent]
                  )}
                >
                  {getInitials(session?.user?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{session?.user?.name ?? ''}</p>
                  <p className="truncate text-xs text-white/40">{session?.user?.email ?? ''}</p>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-white/40 transition hover:text-red-400"
                  title={loc === 'es' ? 'Salir' : loc === 'en' ? 'Log out' : 'Sair'}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex w-full items-center justify-center rounded-lg py-2 text-white/40 transition hover:text-red-400"
                title={loc === 'es' ? 'Salir' : loc === 'en' ? 'Log out' : 'Sair'}
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        <div
          className={cn(
            'relative z-10 flex min-h-screen min-w-0 flex-1 flex-col transition-all',
            collapsed ? 'lg:ml-16' : 'lg:ml-64'
          )}
        >
          <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#07111A]/70 px-4 py-3 backdrop-blur-md lg:hidden">
            <button type="button" onClick={() => setSidebarOpen(true)} className="text-white/70 hover:text-white">
              <Menu className="h-5 w-5" />
            </button>
            <span className={sysTheme.brand}>{meta.name}</span>
          </div>

          <main className="sys-canvas min-w-0 flex-1 overflow-auto p-4 md:p-6">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </SystemLicenseGate>
  );
}
