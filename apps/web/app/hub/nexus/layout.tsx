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
  ChevronRight,
  Globe,
  Bell,
  MessageCircle,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
  ClipboardCheck,
  Route,
  Wrench,
  BookOpen,
  History,
  Rocket,
  Sparkles,
  LayoutGrid,
  Factory,
  Kanban,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { NexusRunwayProvider } from '@/components/nexus/NexusRunwayContext';
import { NexusRunwayBar, NexusRunwayContinueLink } from '@/components/nexus/NexusRunwayBar';
import { NexusCopilotStrip } from '@/components/nexus/NexusCopilotStrip';
import { SystemLicenseGate } from '@/components/hub/SystemLicenseGate';

type NavGroup = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }[];
};

/** Rotas por grupo — estável para efeitos de navegação */
const NEXUS_GROUP_ROUTES: Record<string, string[]> = {
  /** Módulos Etholys ligados à gestão (fora de /hub/nexus, mas o mesmo fluxo NEXUS) */
  integrated: ['/hub/workspace', '/dashboard', '/siep'],
  /** Fase → assistente → diagnóstico → roadmap → redes → pedidos — um grupo, menos ruído no menu */
  trail: [
    '/hub/nexus/journey',
    '/hub/nexus/coach',
    '/hub/nexus/diagnosis',
    '/hub/nexus/roadmap',
    '/hub/nexus/networks',
    '/hub/nexus/services',
  ],
  resources: ['/hub/nexus/library', '/hub/nexus/history'],
};

/** Tema Nexus (violeta) — ATLAS=teal, FundHub=âmbar */

const nx = {
  grad: 'from-violet-600 to-indigo-700',
  activeBg: 'bg-violet-50',
  activeText: 'text-violet-800',
  mutedActive: 'text-violet-700',
  hoverHub: 'hover:text-violet-600 hover:bg-violet-50',
  companyFallback: '#5b21b6',
  avatar: 'bg-violet-100 text-violet-800',
  notifUnread: 'bg-violet-50/50',
  notifLink: 'text-violet-600',
  spin: 'border-violet-600/30 border-t-violet-600',
  chip: 'border-violet-200 bg-violet-50 text-violet-900',
};

function NexusLayoutShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');
  const { tr, locale, setLocale, activeCompanyId, setActiveCompanyId } = useApp();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [chatUnread, setChatUnread] = useState(0);

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

  useEffect(() => {
    for (const [key, routes] of Object.entries(NEXUS_GROUP_ROUTES)) {
      if (routes.some((r) => pathname === r || pathname?.startsWith(r + '/'))) {
        queueMicrotask(() => {
          setOpenGroups((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
        });
        break;
      }
    }
  }, [pathname]);

  const toggleGroup = (key: string) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className={cn('h-8 w-8 animate-spin rounded-full border-2', nx.spin)} />
      </div>
    );
  }

  const topItems = [
    {
      href: withNet('/hub/nexus'),
      icon: LayoutDashboard,
      label: locale === 'es' ? 'Resumen' : locale === 'pt' ? 'Visão geral' : 'Overview',
    },
  ];

  const navGroups: NavGroup[] = [
    {
      key: 'integrated',
      label: locale === 'es' ? 'Gestión (Etholys)' : locale === 'pt' ? 'Gestão (Etholys)' : 'Ops (Etholys)',
      icon: Factory,
      items: [
        {
          href: '/hub/workspace',
          icon: LayoutGrid,
          label: locale === 'es' ? 'Centro hoy' : locale === 'pt' ? 'Centro hoje' : 'Today hub',
        },
        {
          href: '/dashboard',
          icon: BarChart3,
          label: 'ATLAS',
        },
        {
          href: '/siep',
          icon: Kanban,
          label: 'SIEP',
        },
      ],
    },
    {
      key: 'trail',
      label: locale === 'es' ? 'Recorrido NEXUS' : locale === 'pt' ? 'Trilha NEXUS' : 'NEXUS path',
      icon: Route,
      items: [
        {
          href: withNet('/hub/nexus/journey'),
          icon: Rocket,
          label: locale === 'es' ? 'Fase y metas' : locale === 'pt' ? 'Fase e metas' : 'Phase & goals',
        },
        {
          href: withNet('/hub/nexus/coach'),
          icon: Sparkles,
          label: locale === 'es' ? 'Asistente IA' : locale === 'pt' ? 'Assistente IA' : 'AI coach',
        },
        {
          href: withNet('/hub/nexus/diagnosis'),
          icon: ClipboardCheck,
          label: locale === 'es' ? 'Diagnóstico' : locale === 'pt' ? 'Diagnóstico' : 'Diagnostics',
        },
        {
          href: withNet('/hub/nexus/roadmap'),
          icon: Route,
          label: locale === 'es' ? 'Ruta viva' : locale === 'pt' ? 'Rota viva' : 'Live roadmap',
        },
        {
          href: withNet('/hub/nexus/networks'),
          icon: Share2,
          label: locale === 'es' ? 'Redes' : locale === 'pt' ? 'Redes' : 'Networks',
        },
        {
          href: withNet('/hub/nexus/services'),
          icon: Wrench,
          label: locale === 'es' ? 'Servicios / tickets' : locale === 'pt' ? 'Serviços / tickets' : 'Services / tickets',
        },
      ],
    },
    {
      key: 'resources',
      label: locale === 'es' ? 'Biblioteca' : locale === 'pt' ? 'Biblioteca' : 'Library',
      icon: BookOpen,
      items: [
        {
          href: withNet('/hub/nexus/library'),
          icon: BookOpen,
          label: locale === 'es' ? 'Método y plantillas' : locale === 'pt' ? 'Método e modelos' : 'Method & templates',
        },
        {
          href: withNet('/hub/nexus/history'),
          icon: History,
          label: locale === 'es' ? 'Historial' : locale === 'pt' ? 'Histórico' : 'History',
        },
      ],
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

  const pathMatches = (href: string) => {
    const path = href.split('?')[0];
    if (path === '/hub/nexus' || path === '/hub/nexus/') {
      return pathname === '/hub/nexus' || pathname === '/hub/nexus/';
    }
    return pathname === path || pathname?.startsWith(`${path}/`);
  };

  return (
    <NexusRunwayProvider>
    <div className="flex min-h-screen bg-gray-50">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex transform flex-col border-r border-gray-200 bg-white transition-all',
          collapsed ? 'w-16' : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className={cn('flex-shrink-0 border-b border-gray-100', collapsed ? 'p-2' : 'p-4')}>
          <div className="flex items-center justify-between">
            <Link href={withNet('/hub/nexus')} className="flex min-w-0 items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white',
                  nx.grad
                )}
              >
                N
              </div>
              {!collapsed && (
                <span className="truncate font-bold text-gray-900">
                  NEX<span className={nx.activeText}>US</span>
                </span>
              )}
            </Link>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="hidden items-center justify-center rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 lg:flex"
                title={collapsed ? 'Expandir' : 'Minimizar'}
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-gray-600 lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          {!collapsed && (
            <Link
              href="/hub"
              className={cn('mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-500 transition', nx.hoverHub)}
            >
              <ChevronDown className="h-3 w-3 rotate-90" />
              {locale === 'es' ? 'Volver al Hub' : locale === 'pt' ? 'Voltar ao Hub' : 'Back to Hub'}
            </Link>
          )}
        </div>

        {!collapsed && companies.length > 0 && (
          <div className="flex-shrink-0 border-b border-gray-100 p-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
                className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm transition hover:bg-gray-100"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Building2 className="h-4 w-4 flex-shrink-0 text-gray-500" />
                  <span className="truncate font-medium text-gray-700">
                    {activeCompany ? activeCompany?.shortName : tr('company.allCompanies')}
                  </span>
                </div>
                <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-gray-400 transition', companyMenuOpen && 'rotate-180')} />
              </button>
              {companyMenuOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCompanyId(null);
                      setCompanyMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50',
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
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50',
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
          </div>
        )}

        <nav className={cn('flex-1 space-y-0.5 overflow-y-auto', collapsed ? 'p-1.5' : 'p-3')}>
          <NexusRunwayContinueLink
            collapsed={collapsed}
            networkId={networkId}
            onNavigate={() => setSidebarOpen(false)}
          />
          {topItems.map((item) => {
            const isActive = pathMatches(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center rounded-lg text-sm font-medium transition',
                  collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                  isActive ? cn(nx.activeBg, nx.activeText) : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}

          <div className="py-1 pb-2">
            <div className="h-px bg-gray-100" />
          </div>

          {navGroups.map((group) => {
            const isOpen = openGroups[group.key] ?? false;
            const hasActiveChild = group.items.some((i) => pathMatches(i.href));
            if (collapsed) {
              return group.items.map((item) => {
                const isActive = pathMatches(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    title={item.label}
                    className={cn(
                      'flex items-center justify-center rounded-lg px-2 py-2.5 text-sm transition',
                      isActive ? cn(nx.activeBg, nx.activeText, 'font-medium') : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                  </Link>
                );
              });
            }
            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition',
                    hasActiveChild ? nx.mutedActive : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <group.icon className="h-4 w-4" />
                    {group.label}
                  </div>
                  <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-200', isOpen && 'rotate-90')} />
                </button>
                {isOpen && (
                  <div className="mb-1 ml-3 mt-0.5 space-y-0.5 border-l border-gray-100 pl-3">
                    {group.items.map((item) => {
                      const isActive = pathMatches(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
                            isActive
                              ? cn(nx.activeBg, nx.activeText, 'font-medium')
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="py-1 pb-2">
            <div className="h-px bg-gray-100" />
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
                  isActive ? cn(nx.activeBg, nx.activeText) : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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

        <div className={cn('flex-shrink-0 border-t border-gray-100', collapsed ? 'p-1.5' : 'p-3')}>
          <div className={cn('mb-2 flex items-center', collapsed ? 'flex-col gap-1' : 'gap-1')}>
            <button
              type="button"
              onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg text-xs text-gray-600 transition hover:bg-gray-100',
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
                className="relative rounded-lg p-2 text-gray-600 transition hover:bg-gray-100"
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
                <p className="truncate text-sm font-medium text-gray-900">{session?.user?.name ?? ''}</p>
                <p className="truncate text-xs text-gray-500">{session?.user?.email ?? ''}</p>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-gray-400 transition hover:text-red-500"
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
              className="mt-1 flex w-full items-center justify-center rounded-lg py-2 text-gray-400 transition hover:text-red-500"
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

      <div className={cn('flex min-h-screen min-w-0 flex-1 flex-col transition-all', collapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur-md lg:hidden">
          <button type="button" onClick={() => setSidebarOpen(true)} className="text-gray-600 hover:text-gray-900">
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

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mx-auto max-w-6xl">
            <NexusRunwayBar />
            <NexusCopilotStrip />
            <SystemLicenseGate system="NEXUS">{children}</SystemLicenseGate>
          </div>
        </main>
      </div>
    </div>
    </NexusRunwayProvider>
  );
}

export default function NexusLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-600" />
        </div>
      }
    >
      <NexusLayoutShell>{children}</NexusLayoutShell>
    </Suspense>
  );
}
