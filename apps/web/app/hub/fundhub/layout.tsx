'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
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
  Search,
  Heart,
  Lightbulb,
  ShieldCheck,
  Users,
  HandCoins,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';

type NavGroup = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }[];
};

/** Cor de sistema FundHub (laranja/âmbar) — ATLAS=teal, SIEP=indigo */
const fh = {
  grad: 'from-amber-500 to-orange-600',
  activeBg: 'bg-amber-50',
  activeText: 'text-amber-800',
  mutedActive: 'text-amber-700',
  hoverHub: 'hover:text-amber-600 hover:bg-amber-50',
  companyFallback: '#d97706',
  avatar: 'bg-amber-100 text-amber-800',
  notifUnread: 'bg-amber-50/50',
  notifLink: 'text-amber-600',
  spin: 'border-amber-600/30 border-t-amber-600',
};

export default function FundHubLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
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

  const groupRoutes: Record<string, string[]> = {
    funds: ['/hub/fundhub/discover', '/hub/fundhub/my-funds'],
    pipeline: ['/hub/fundhub/proposals', '/hub/fundhub/compliance', '/hub/fundhub/partners'],
  };

  useEffect(() => {
    for (const [key, routes] of Object.entries(groupRoutes)) {
      if (routes.some((r) => pathname === r || pathname?.startsWith(r + '/'))) {
        setOpenGroups((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
        break;
      }
    }
  }, [pathname]);

  const toggleGroup = (key: string) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className={cn('w-8 h-8 border-2 rounded-full animate-spin', fh.spin)} />
      </div>
    );
  }

  const topItems = [
    {
      href: '/hub/fundhub',
      icon: LayoutDashboard,
      label: locale === 'es' ? 'Resumen' : locale === 'pt' ? 'Visão geral' : 'Overview',
    },
  ];

  const navGroups: NavGroup[] = [
    {
      key: 'funds',
      label: locale === 'es' ? 'Fondos' : locale === 'pt' ? 'Fundos' : 'Funds',
      icon: HandCoins,
      items: [
        {
          href: '/hub/fundhub/discover',
          icon: Search,
          label: locale === 'es' ? 'Descubrir' : locale === 'pt' ? 'Descobrir' : 'Discover',
        },
        {
          href: '/hub/fundhub/my-funds',
          icon: Heart,
          label: locale === 'es' ? 'Mis fondos' : locale === 'pt' ? 'Meus fundos' : 'My funds',
        },
      ],
    },
    {
      key: 'pipeline',
      label: locale === 'es' ? 'Propuestas y alianzas' : locale === 'pt' ? 'Propostas e parcerias' : 'Proposals & partners',
      icon: Lightbulb,
      items: [
        {
          href: '/hub/fundhub/proposals',
          icon: Lightbulb,
          label: locale === 'es' ? 'Propuestas' : locale === 'pt' ? 'Propostas' : 'Proposals',
        },
        {
          href: '/hub/fundhub/compliance',
          icon: ShieldCheck,
          label: 'Compliance',
        },
        {
          href: '/hub/fundhub/partners',
          icon: Users,
          label: locale === 'es' ? 'Socios' : locale === 'pt' ? 'Parceiros' : 'Partners',
        },
      ],
    },
  ];

  const bottomItems = [
    { href: '/chat', icon: MessageCircle, label: 'Chat', badge: chatUnread > 0 ? chatUnread : undefined },
    { href: '/reports', icon: BarChart3, label: tr('nav.reports') },
    { href: '/hub/fundhub/settings', icon: Settings, label: tr('nav.settings') },
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
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transform transition-all flex flex-col',
          collapsed ? 'w-16' : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className={cn('border-b border-gray-100 flex-shrink-0', collapsed ? 'p-2' : 'p-4')}>
          <div className="flex items-center justify-between">
            <Link href="/hub/fundhub" className="flex items-center gap-2 min-w-0">
              <div
                className={cn(
                  'w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
                  fh.grad
                )}
              >
                F
              </div>
              {!collapsed && (
                <span className="font-bold text-gray-900 truncate">
                  FUND<span className={fh.activeText}>HUB</span>
                </span>
              )}
            </Link>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition"
                title={collapsed ? 'Expandir' : 'Minimizar'}
              >
                {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {!collapsed && (
            <Link
              href="/hub"
              className={cn(
                'mt-2 flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 rounded-md transition',
                fh.hoverHub
              )}
            >
              <ChevronDown className="w-3 h-3 rotate-90" />
              {locale === 'es' ? 'Volver al Hub' : locale === 'pt' ? 'Voltar ao Hub' : 'Back to Hub'}
            </Link>
          )}
        </div>

        {!collapsed && companies.length > 0 && (
          <div className="p-3 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="font-medium text-gray-700 truncate">
                    {activeCompany ? activeCompany?.shortName : tr('company.allCompanies')}
                  </span>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-gray-400 transition flex-shrink-0', companyMenuOpen && 'rotate-180')} />
              </button>
              {companyMenuOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-50 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCompanyId(null);
                      setCompanyMenuOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2',
                      !activeCompanyId && cn(fh.mutedActive, 'font-medium')
                    )}
                  >
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
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
                        'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2',
                        activeCompanyId === c?.id && cn(fh.mutedActive, 'font-medium')
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c?.color ?? fh.companyFallback }}
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
          {topItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center rounded-lg text-sm font-medium transition',
                  collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                  isActive ? cn(fh.activeBg, fh.activeText) : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}

          <div className="pt-2 pb-1">
            <div className="h-px bg-gray-100" />
          </div>

          {navGroups.map((group) => {
            const isOpen = openGroups[group.key] ?? false;
            const hasActiveChild = group.items.some(
              (i) => pathname === i.href || pathname?.startsWith(i.href + '/')
            );
            if (collapsed) {
              return group.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    title={item.label}
                    className={cn(
                      'flex items-center justify-center px-2 py-2.5 rounded-lg text-sm transition',
                      isActive ? cn(fh.activeBg, fh.activeText, 'font-medium') : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
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
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition',
                    hasActiveChild ? fh.mutedActive : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <group.icon className="w-4 h-4" />
                    {group.label}
                  </div>
                  <ChevronRight className={cn('w-3.5 h-3.5 transition-transform duration-200', isOpen && 'rotate-90')} />
                </button>
                {isOpen && (
                  <div className="ml-3 pl-3 border-l border-gray-100 space-y-0.5 mt-0.5 mb-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition',
                            isActive
                              ? cn(fh.activeBg, fh.activeText, 'font-medium')
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          )}
                        >
                          <item.icon className="w-4 h-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-2 pb-1">
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
                  isActive ? cn(fh.activeBg, fh.activeText) : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {(item as { badge?: number }).badge != null && (item as { badge?: number }).badge! > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {(item as { badge?: number }).badge! > 9 ? '9+' : (item as { badge?: number }).badge}
                    </div>
                  )}
                </div>
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        <div className={cn('border-t border-gray-100 flex-shrink-0', collapsed ? 'p-1.5' : 'p-3')}>
          <div className={cn('flex items-center mb-2', collapsed ? 'flex-col gap-1' : 'gap-1')}>
            <button
              type="button"
              onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')}
              className={cn(
                'flex items-center gap-1.5 text-xs rounded-lg hover:bg-gray-100 transition text-gray-600',
                collapsed ? 'p-2 justify-center' : 'px-2.5 py-1.5 flex-1'
              )}
              title={collapsed ? String(locale?.toUpperCase()) : undefined}
            >
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              {!collapsed && locale?.toUpperCase()}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600 relative"
              >
                <Bell className="w-3.5 h-3.5" />
                {notifCount > 0 && (
                  <div className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {notifCount > 9 ? '9+' : notifCount}
                  </div>
                )}
              </button>
              {notifOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-80 bg-white rounded-xl shadow-lg border z-[60] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="text-sm font-semibold text-gray-900">
                      {locale === 'es' ? 'Notificaciones' : locale === 'pt' ? 'Notificações' : 'Notifications'}
                    </span>
                    {notifCount > 0 && (
                      <button type="button" onClick={markAllNotifRead} className={cn('text-xs hover:underline', fh.notifLink)}>
                        {locale === 'es' ? 'Marcar leídas' : locale === 'pt' ? 'Marcar lidas' : 'Mark all read'}
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y">
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
                          className={cn(
                            'px-4 py-3 hover:bg-gray-50 cursor-pointer transition',
                            !n.read && fh.notifUnread
                          )}
                        >
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
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
            <div className="flex items-center gap-3 px-3 py-2 mt-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  fh.avatar
                )}
              >
                {getInitials(session?.user?.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{session?.user?.name ?? ''}</p>
                <p className="text-xs text-gray-500 truncate">{session?.user?.email ?? ''}</p>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-gray-400 hover:text-red-500 transition"
                title={tr('auth.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center justify-center w-full py-2 rounded-lg text-gray-400 hover:text-red-500 transition mt-1"
              title={tr('auth.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}

      <div
        className={cn(
          'flex-1 flex flex-col min-h-screen min-w-0 transition-all',
          collapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        <div className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={() => setSidebarOpen(true)} className="text-gray-600 hover:text-gray-900">
            <Menu className="w-5 h-5" />
          </button>
          {activeCompany && (
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium min-w-0"
              style={{
                backgroundColor: `${activeCompany?.color ?? fh.companyFallback}15`,
                color: activeCompany?.color ?? fh.companyFallback,
              }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: activeCompany?.color ?? fh.companyFallback }}
              />
              <span className="truncate">{activeCompany?.name ?? ''}</span>
            </div>
          )}
        </div>

        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
