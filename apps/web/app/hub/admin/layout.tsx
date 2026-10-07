'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CreditCard,
  LayoutDashboard,
  Layers,
  Menu,
  Users,
  User,
  X,
  ClipboardList,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { AdminAccessGuard } from '@/components/hub/AdminAccessGuard';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { AppearanceToggle } from '@/components/hub/AppearanceToggle';
import { CompanyPicker } from '@/components/hub/CompanyPicker';
import { useEnsureActiveCompany } from '@/hooks/useEnsureActiveCompany';
import { sysTheme } from '@/lib/system-shell';
import { cn } from '@/lib/utils';
import {
  adminHref,
  parseAdminSection,
  type AdminSection,
} from '@/lib/admin-control';

function navLabel(section: AdminSection, locale: string) {
  const row: Record<AdminSection, { pt: string; es: string; en: string }> = {
    overview: { pt: 'Visão geral', es: 'Resumen', en: 'Overview' },
    companies: { pt: 'Empresas', es: 'Empresas', en: 'Companies' },
    'org-profile': {
      pt: 'Perfil da organização',
      es: 'Perfil de la organización',
      en: 'Organization profile',
    },
    areas: { pt: 'Áreas / sectores', es: 'Áreas / sectores', en: 'Areas / sectors' },
    users: { pt: 'Utilizadores', es: 'Usuarios', en: 'Users' },
    access: { pt: 'Utilizadores', es: 'Usuarios', en: 'Users' },
    billing: { pt: 'Licenças e pagamentos', es: 'Licencias y pagos', en: 'Licenses & billing' },
    account: { pt: 'Conta pessoal', es: 'Cuenta personal', en: 'Personal account' },
  };
  const L = row[section];
  return locale === 'pt' ? L.pt : locale === 'es' ? L.es : L.en;
}

const NAV: { id: AdminSection; icon: typeof Building2; group: 'org' | 'people' | 'commerce' | 'you' }[] = [
  { id: 'overview', icon: LayoutDashboard, group: 'org' },
  { id: 'companies', icon: Building2, group: 'org' },
  { id: 'org-profile', icon: ClipboardList, group: 'org' },
  { id: 'areas', icon: Layers, group: 'org' },
  { id: 'users', icon: Users, group: 'people' },
  { id: 'billing', icon: CreditCard, group: 'commerce' },
  { id: 'account', icon: User, group: 'you' },
];

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const { locale, activeCompanyId, setActiveCompanyId } = useApp();
  const {
    companies,
    companiesReady,
    companiesLoadError,
    reloadCompanies,
  } = useEnsureActiveCompany();
  const search = useSearchParams();
  const pathname = usePathname();
  const section = parseAdminSection(search.get('s'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const groupTitle = (g: string) => {
    if (g === 'org') return t('Organização', 'Organización', 'Organization');
    if (g === 'people') return t('Equipa', 'Equipo', 'Team');
    if (g === 'commerce') return t('Comercial', 'Comercial', 'Commercial');
    return t('A sua conta', 'Su cuenta', 'Your account');
  };

  const groups = ['org', 'people', 'commerce', 'you'] as const;

  // Sub-rotas (ex. agents) — sem forçar secção
  const isNested = pathname !== '/hub/admin' && pathname?.startsWith('/hub/admin/');

  const Nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            {groupTitle(g)}
          </p>
          <div className="space-y-0.5">
            {NAV.filter((n) => n.group === g).map((item) => {
              const active = !isNested && section === item.id;
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={adminHref(item.id)}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                    active ? sysTheme.active.teal : sysTheme.navIdle
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="truncate">{navLabel(item.id, locale)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className={sysTheme.root} data-accent="teal">
      <SystemAtmosphere accent="teal" />
      <aside
        className={cn(
          sysTheme.aside,
          'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex-shrink-0 border-b border-white/10 p-4">
          <div className="flex items-center justify-between gap-2">
            <Link href="/hub/admin" className="flex min-w-0 items-center gap-2" onClick={() => setMobileOpen(false)}>
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', sysTheme.icon.teal)}>
                <Layers className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className={cn('truncate', sysTheme.brand)}>ETHOLYS</p>
                <p className="truncate text-xs text-white/55">
                  {t('Central de controlo', 'Centro de control', 'Control center')}
                </p>
              </div>
            </Link>
            <button
              type="button"
              className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <Link
            href="/hub"
            className="mt-3 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/40 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" />
            {t('Voltar ao Hub', 'Volver al Hub', 'Back to Hub')}
          </Link>
          <div className="mt-3 px-0.5">
            <p className="mb-1.5 px-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              {t('Empresa activa', 'Empresa activa', 'Active company')}
            </p>
            <CompanyPicker
              companies={companies}
              activeCompanyId={String(activeCompanyId || '')}
              onSelect={(id) => setActiveCompanyId(id)}
              ready={companiesReady}
              error={companiesLoadError}
              onRetry={() => void reloadCompanies()}
              tone="dark"
              locale={locale}
              className="w-full"
            />
          </div>
        </div>
        {Nav}
        <div className="flex-shrink-0 border-t border-white/10 p-3">
          <AppearanceToggle />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col lg:ml-64">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#07111A]/80 px-4 py-3 backdrop-blur-md lg:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} className="text-white/70 hover:text-white">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-white">
            {isNested
              ? t('Administração', 'Administración', 'Administration')
              : navLabel(section, locale)}
          </span>
        </div>
        <main className="sys-canvas min-w-0 flex-1 overflow-auto p-4 md:p-6">
          <div className={cn('mx-auto', section === 'users' ? 'max-w-6xl' : 'max-w-5xl')}>
            <AdminAccessGuard companyId={activeCompanyId}>{children}</AdminAccessGuard>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function EtholysAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#07111A]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/25 border-t-teal-400" />
        </div>
      }
    >
      <AdminShellInner>{children}</AdminShellInner>
    </Suspense>
  );
}
