'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useApp } from '@/app/providers';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Globe,
  Bell,
  MessageCircle,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  Headphones,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { NexusRunwayProvider } from '@/components/nexus/NexusRunwayContext';
import { NexusCopilotRail } from '@/components/nexus/NexusCopilotRail';
import { SystemLicenseGate } from '@/components/hub/SystemLicenseGate';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { sysTheme } from '@/lib/system-shell';

/** Capítulos internos — não são itens de menu. Só servem para realçar o caminho. */
const NEXUS_MINE_PATHS = [
  '/hub/nexus/journey',
  '/hub/nexus/coach',
  '/hub/nexus/diagnosis',
  '/hub/nexus/roadmap',
  '/hub/nexus/campo',
  '/hub/nexus/monitor',
];
const NEXUS_DELIVER_PATHS = ['/hub/nexus/at', '/hub/nexus/networks', '/hub/nexus/services'];

/** Tema NEXUS — ink + teal (autodesarrollo); AT usa acento próprio nas secções */

const nx = {
  grad: 'from-slate-900 to-teal-900',
  activeBg: 'bg-teal-500/15',
  activeText: 'text-teal-100',
  mutedActive: 'text-teal-200',
  hoverHub: 'hover:text-teal-200 hover:bg-white/5',
  companyFallback: '#0f766e',
  avatar: 'bg-teal-500/20 text-teal-100',
  notifUnread: 'bg-teal-500/10',
  notifLink: 'text-teal-200',
  spin: 'border-teal-400/25 border-t-teal-400',
  chip: 'border-teal-400/25 bg-teal-500/10 text-teal-100',
};

function NexusLayoutShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');
  const atSubjectCompanyId = searchParams.get('company');
  const atEngagementId = searchParams.get('engagement');
  const { tr, locale, setLocale, activeCompanyId, setActiveCompanyId } = useApp();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [atSubjectLabel, setAtSubjectLabel] = useState<string | null>(null);

  /** Diagnóstico AT de uma MIPYME cliente — ≠ percurso da empresa operadora no seletor */
  const isAtClientDiagnosis =
    Boolean(
      pathname?.startsWith('/hub/nexus/diagnosis') ||
        pathname?.startsWith('/hub/nexus/campo') ||
        pathname?.startsWith('/hub/nexus/monitor')
    ) &&
    Boolean(atSubjectCompanyId) &&
    atSubjectCompanyId !== activeCompanyId;

  useEffect(() => {
    if (!isAtClientDiagnosis || !atSubjectCompanyId) {
      setAtSubjectLabel(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (atEngagementId) {
          const r = await fetch(`/api/nexus/at/engagements/${encodeURIComponent(atEngagementId)}`);
          const d = await r.json();
          const m = (d.engagement?.members || []).find(
            (x: { companyId: string }) => x.companyId === atSubjectCompanyId
          );
          const name = m?.company?.name || m?.company?.shortName;
          if (!cancelled && name) {
            setAtSubjectLabel(name);
            return;
          }
        }
        const r = await fetch(
          `/api/nexus/at/client-companies?q=${encodeURIComponent(atSubjectCompanyId)}&take=20`
        );
        const d = await r.json();
        const hit = (d.companies || []).find((c: { id: string }) => c.id === atSubjectCompanyId);
        if (!cancelled) {
          setAtSubjectLabel(hit?.name || hit?.shortName || atSubjectCompanyId.slice(0, 8));
        }
      } catch {
        if (!cancelled) setAtSubjectLabel(atSubjectCompanyId.slice(0, 8));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAtClientDiagnosis, atSubjectCompanyId, atEngagementId]);

  const withNet = (href: string) => {
    const path = href.split('?')[0];
    if (!networkId) return path;
    return `${path}?network=${encodeURIComponent(networkId)}`;
  };

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/companies')
        .then((r) => r.json())
        .then((d) => setCompanies(d?.companies ?? []))
        .catch(() => {});
      const fetchNotifs = () => {
        fetch('/api/notifications?limit=10')
          .then((r) => r.json())
          .then((d) => {
            setNotifCount(d?.unreadCount ?? 0);
            setNotifications(d?.notifications ?? []);
          })
          .catch(() => {});
      };
      fetchNotifs();
      const fetchChatUnread = () => {
        fetch('/api/chat/unread')
          .then((r) => r.json())
          .then((d) => setChatUnread(d?.unreadCount ?? 0))
          .catch(() => {});
      };
      fetchChatUnread();
      const interval = setInterval(() => {
        fetchNotifs();
        fetchChatUnread();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [status]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111A]">
        <div className={cn('h-8 w-8 animate-spin rounded-full border-2', nx.spin)} />
      </div>
    );
  }

  const pathIn = (routes: string[]) =>
    routes.some((r) => pathname === r || pathname?.startsWith(`${r}/`));

  const primaryItems = [
    {
      key: 'home',
      href: withNet('/hub/nexus'),
      icon: LayoutDashboard,
      label: locale === 'es' ? 'Inicio' : locale === 'pt' ? 'Início' : 'Home',
      active: pathname === '/hub/nexus' || pathname === '/hub/nexus/',
      tone: 'home' as const,
    },
    {
      key: 'mine',
      href: withNet('/hub/nexus/campo'),
      icon: Sparkles,
      label:
        locale === 'es' ? 'Mi módulo' : locale === 'pt' ? 'O meu módulo' : 'My module',
      active: !isAtClientDiagnosis && pathIn(NEXUS_MINE_PATHS),
      tone: 'mine' as const,
    },
    {
      key: 'deliver',
      href: withNet('/hub/nexus/at'),
      icon: Headphones,
      label:
        locale === 'es'
          ? 'Asistencia técnica'
          : locale === 'pt'
            ? 'Assistência técnica'
            : 'Technical assistance',
      active: isAtClientDiagnosis || pathIn(NEXUS_DELIVER_PATHS),
      tone: 'deliver' as const,
    },
  ];

  const bottomItems = [
    { href: '/chat', icon: MessageCircle, label: 'Chat', badge: chatUnread > 0 ? chatUnread : undefined },
    { href: '/reports', icon: BarChart3, label: tr('nav.reports') },
    { href: '/hub/nexus/settings', icon: Settings, label: tr('nav.settings') },
  ];

  const activeCompany = companies?.find((c: any) => c?.id === activeCompanyId);

  const markAllNotifRead = () => {
    fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    }).then(() => {
      setNotifCount(0);
      setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    });
  };

  return (
    <NexusRunwayProvider>
    <div className={sysTheme.root} data-accent="teal">
      <SystemAtmosphere accent="teal" />
      <aside
        className={cn(
          sysTheme.aside,
          collapsed ? 'w-16' : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className={cn('flex-shrink-0 border-b border-white/10', collapsed ? 'p-2' : 'p-4')}>
          <div className="flex items-center justify-between">
            <Link href={withNet('/hub/nexus')} className="flex min-w-0 items-center gap-2">
              <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border', sysTheme.icon.teal)}>
                <GraduationCap className="h-4 w-4" strokeWidth={1.75} />
              </div>
              {!collapsed && (
                <span className={cn('truncate', sysTheme.brand)}>NEXUS</span>
              )}
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
            <Link
              href="/hub"
              className={cn('mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/50 transition', nx.hoverHub)}
            >
              <ChevronDown className="h-3 w-3 rotate-90" />
              {locale === 'es' ? 'Volver al Hub' : locale === 'pt' ? 'Voltar ao Hub' : 'Back to Hub'}
            </Link>
          )}
        </div>

        {!collapsed && companies.length > 0 && (
          <div className="flex-shrink-0 border-b border-white/10 p-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
                className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 transition hover:bg-white/[0.07]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Building2 className="h-4 w-4 flex-shrink-0 text-white/40" />
                  <span className="truncate font-medium">
                    {activeCompany ? activeCompany?.shortName : tr('company.allCompanies')}
                  </span>
                </div>
                <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-white/35 transition', companyMenuOpen && 'rotate-180')} />
              </button>
              {companyMenuOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-white/10 bg-[#0C1822] py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCompanyId(null);
                      setCompanyMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#E8EEF2] hover:bg-white/10',
                      !activeCompanyId && cn(nx.mutedActive, 'font-medium')
                    )}
                  >
                    <div className="h-3 w-3 rounded-full bg-gray-400" />
                    {tr('company.allCompanies')}
                  </button>
                  {(companies ?? []).map((c: any) => (
                    <button
                      key={c?.id}
                      type="button"
                      onClick={() => {
                        setActiveCompanyId(c?.id);
                        setCompanyMenuOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#E8EEF2] hover:bg-white/10',
                        activeCompanyId === c?.id && cn(nx.mutedActive, 'font-medium')
                      )}
                    >
                      <div
                        className="h-3 w-3 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: c?.color ?? nx.companyFallback }}
                      />
                      {c?.shortName ?? ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isAtClientDiagnosis && (
              <div className="rounded-lg border border-teal-400/25 bg-teal-500/10 px-3 py-2">
                <p className="mt-0.5 truncate text-xs font-medium text-teal-100">
                  {atSubjectLabel || '…'}
                </p>
                {atEngagementId && (
                  <Link
                    href={`/hub/nexus/at/${encodeURIComponent(atEngagementId)}`}
                    className="mt-1 inline-block text-[11px] font-medium text-teal-200 underline"
                    onClick={() => setSidebarOpen(false)}
                  >
                    {locale === 'es' ? 'Volver al contrato' : locale === 'pt' ? 'Voltar ao contrato' : 'Back to contract'}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        <nav className={cn('flex-1 space-y-0.5 overflow-y-auto', collapsed ? 'p-1.5' : 'p-3')}>
          {primaryItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition',
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                item.active
                  ? item.tone === 'deliver'
                    ? 'bg-orange-500/15 text-orange-100'
                    : cn(nx.activeBg, nx.activeText)
                  : sysTheme.navIdle
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && item.label}
            </Link>
          ))}

          <div className="py-1 pb-2">
            <div className="h-px bg-white/10" />
          </div>

          {bottomItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center rounded-lg text-sm font-medium transition',
                  collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                  isActive ? cn(nx.activeBg, nx.activeText) : sysTheme.navIdle
                )}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {(item as { badge?: number }).badge != null && (item as { badge?: number }).badge! > 0 && (
                    <div className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {(item as { badge?: number }).badge! > 9 ? '9+' : (item as { badge?: number }).badge}
                    </div>
                  )}
                </div>
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        <div className={cn('flex-shrink-0 border-t border-white/10', collapsed ? 'p-1.5' : 'p-3')}>
          <div className={cn('mb-2 flex items-center', collapsed ? 'flex-col gap-1' : 'gap-1')}>
            <button
              type="button"
              onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg text-xs text-white/60 transition hover:bg-white/10 hover:text-white',
                collapsed ? 'justify-center p-2' : 'flex-1 px-2.5 py-1.5'
              )}
              title={collapsed ? String(locale?.toUpperCase()) : undefined}
            >
              <Globe className="h-3.5 w-3.5 flex-shrink-0" />
              {!collapsed && locale?.toUpperCase()}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <Bell className="h-3.5 w-3.5" />
                {notifCount > 0 && (
                  <div className="absolute right-0.5 top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                    {notifCount > 9 ? '9+' : notifCount}
                  </div>
                )}
              </button>
              {notifOpen && (
                <div className="absolute bottom-full left-0 z-[60] mb-1 w-80 overflow-hidden rounded-xl border bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {locale === 'es' ? 'Notificaciones' : locale === 'pt' ? 'Notificações' : 'Notifications'}
                    </span>
                    {notifCount > 0 && (
                      <button type="button" onClick={markAllNotifRead} className={cn('text-xs hover:underline', nx.notifLink)}>
                        {locale === 'es' ? 'Marcar leídas' : locale === 'pt' ? 'Marcar lidas' : 'Mark all read'}
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 divide-y overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        {locale === 'es' ? 'Sin notificaciones' : locale === 'pt' ? 'Sem notificações' : 'No notifications'}
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (n.link) router.push(n.link);
                              if (!n.read) {
                                fetch('/api/notifications', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: n.id }),
                                });
                              }
                              setNotifOpen(false);
                            }
                          }}
                          onClick={() => {
                            if (n.link) router.push(n.link);
                            if (!n.read) {
                              fetch('/api/notifications', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: n.id }),
                              });
                            }
                            setNotifOpen(false);
                          }}
                          className={cn('cursor-pointer px-4 py-3 transition hover:bg-gray-50', !n.read && nx.notifUnread)}
                        >
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.message}</p>
                          <p className="mt-1 text-[10px] text-gray-400">
                            {new Date(n.createdAt).toLocaleDateString('es-UY')}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!collapsed && (
            <div className="mt-1 flex items-center gap-3 px-3 py-2">
              <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold', nx.avatar)}>
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
                title={tr('auth.logout')}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="mt-1 flex w-full items-center justify-center rounded-lg py-2 text-white/40 transition hover:text-red-400"
              title={tr('auth.logout')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}

      <div className={cn('relative z-10 flex min-h-screen min-w-0 flex-1 flex-col transition-all', collapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#07111A]/70 px-4 py-3 backdrop-blur-md lg:hidden">
          <button type="button" onClick={() => setSidebarOpen(true)} className="text-white/70 hover:text-white">
            <Menu className="h-5 w-5" />
          </button>
          {activeCompany && (
            <div
              className="flex min-w-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: `${activeCompany?.color ?? nx.companyFallback}15`,
                color: activeCompany?.color ?? nx.companyFallback,
              }}
            >
              <div
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ backgroundColor: activeCompany?.color ?? nx.companyFallback }}
              />
              <span className="truncate">{activeCompany?.name ?? ''}</span>
            </div>
          )}
        </div>

        {networkId && (
          <div className={cn('border-b px-4 py-2 text-xs md:px-6', nx.chip)}>
            <span className="font-semibold">
              {locale === 'es' ? 'Modo red' : locale === 'pt' ? 'Modo rede' : 'Network mode'}
            </span>{' '}
            · <span className="font-mono">{networkId}</span> ·{' '}
            {locale === 'es'
              ? 'Las rutas conservan este contexto.'
              : locale === 'pt'
                ? 'As rotas mantêm este contexto.'
                : 'Routes keep this context.'}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <main className="sys-canvas min-w-0 flex-1 overflow-auto p-4 md:p-6">
            <div className="mx-auto max-w-6xl">
              <SystemLicenseGate system="NEXUS">{children}</SystemLicenseGate>
            </div>
          </main>
          <NexusCopilotRail />
        </div>
      </div>
    </div>
    </NexusRunwayProvider>
  );
}

export default function NexusLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#07111A]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/25 border-t-teal-400" />
        </div>
      }
    >
      <NexusLayoutShell>{children}</NexusLayoutShell>
    </Suspense>
  );
}
