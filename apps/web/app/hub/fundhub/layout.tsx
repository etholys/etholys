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
  Globe,
  Bell,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Heart,
  Lightbulb,
  ShieldCheck,
  Users,
  HandCoins,
  MapPin,
  Handshake,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { SystemLicenseGate } from '@/components/hub/SystemLicenseGate';

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

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111A]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/25 border-t-amber-400" />
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

  const workItems = [
    {
      href: '/hub/fundhub/discover',
      icon: Search,
      label: locale === 'es' ? 'Buscar' : locale === 'pt' ? 'Buscar' : 'Search',
    },
    {
      href: '/hub/fundhub/my-funds',
      icon: Heart,
      label: locale === 'es' ? 'En curso' : locale === 'pt' ? 'Em curso' : 'In progress',
    },
    {
      href: '/hub/fundhub/proposals',
      icon: Lightbulb,
      label: locale === 'es' ? 'Propuestas' : locale === 'pt' ? 'Propostas' : 'Proposals',
    },
  ];

  const setupItems = [
    {
      href: '/hub/fundhub/passport',
      icon: Building2,
      label: locale === 'es' ? 'Perfil' : locale === 'pt' ? 'Perfil' : 'Profile',
    },
    {
      href: '/hub/fundhub/demand',
      icon: MapPin,
      label: locale === 'es' ? 'Mapa' : locale === 'pt' ? 'Mapa' : 'Map',
    },
    {
      href: '/hub/fundhub/compliance',
      icon: ShieldCheck,
      label: 'Compliance',
    },
    {
      href: '/hub/fundhub/coalition',
      icon: Users,
      label: locale === 'es' ? 'Coalición' : locale === 'pt' ? 'Coalizão' : 'Coalition',
    },
    {
      href: '/hub/fundhub/partners',
      icon: Handshake,
      label: locale === 'es' ? 'Socios' : locale === 'pt' ? 'Parceiros' : 'Partners',
    },
  ];

  const bottomItems = [
    { href: '/chat', icon: MessageCircle, label: 'Chat', badge: chatUnread > 0 ? chatUnread : undefined },
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

  const navClass = (active: boolean, collapsedNav: boolean) =>
    cn(
      'flex items-center rounded-lg text-sm font-medium transition',
      collapsedNav ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
      active
        ? 'bg-amber-500/15 text-amber-100'
        : 'text-white/55 hover:bg-white/[0.05] hover:text-white',
    );

  return (
    <div className="etholys-fundhub etholys-hub relative isolate flex min-h-screen overflow-hidden bg-[#07111A] text-[#E8EEF2]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_78%_8%,rgba(217,119,6,0.22),transparent_52%),radial-gradient(90%_70%_at_8%_92%,rgba(15,23,42,0.9),transparent_50%),linear-gradient(165deg,#041018_0%,#0B1C24_42%,#07111A_100%)]"
      />
      <div aria-hidden className="etholys-site-grid pointer-events-none absolute inset-0 opacity-[0.12]" />
      <div
        aria-hidden
        className="etholys-site-orbit pointer-events-none absolute -right-[24%] top-[-10%] h-[78vmin] w-[78vmin] rounded-full border border-amber-400/15"
      />
      <div
        aria-hidden
        className="etholys-site-orbit-slow pointer-events-none absolute -right-[8%] top-[18%] h-[46vmin] w-[46vmin] rounded-full border border-amber-300/10"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex transform flex-col border-r border-white/10 bg-[#07111A]/88 backdrop-blur-md transition-all',
          collapsed ? 'w-16' : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className={cn('flex-shrink-0 border-b border-white/10', collapsed ? 'p-2' : 'p-4')}>
          <div className="flex items-center justify-between">
            <Link href="/hub/fundhub" className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/15">
                <HandCoins className="h-4 w-4 text-amber-300" strokeWidth={1.75} />
              </div>
              {!collapsed && (
                <span className="truncate font-[family-name:var(--font-etholys-display)] text-sm font-bold tracking-wide text-white">
                  FundHub
                </span>
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
              className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/40 transition hover:bg-white/5 hover:text-amber-200"
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
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-white/10 bg-[#0C1822] py-1 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)]">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCompanyId(null);
                      setCompanyMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5',
                      !activeCompanyId ? 'font-medium text-amber-200' : 'text-white/70',
                    )}
                  >
                    <div className="h-3 w-3 rounded-full bg-white/30" />
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
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5',
                        activeCompanyId === c?.id ? 'font-medium text-amber-200' : 'text-white/70',
                      )}
                    >
                      <div
                        className="h-3 w-3 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: c?.color ?? '#d97706' }}
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
                className={navClass(isActive, collapsed)}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}

          <div className="py-2">
            <div className="h-px bg-white/10" />
          </div>

          {workItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                className={navClass(isActive, collapsed)}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}

          <div className="py-2">
            <div className="h-px bg-white/10" />
          </div>

          {setupItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                className={navClass(isActive, collapsed)}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}

          <div className="py-2">
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
                className={navClass(isActive, collapsed)}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {(item as { badge?: number }).badge != null && (item as { badge?: number }).badge! > 0 && (
                    <div className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-950">
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
                'flex items-center gap-1.5 rounded-lg text-xs uppercase tracking-wider text-white/45 transition hover:bg-white/5 hover:text-white',
                collapsed ? 'justify-center p-2' : 'flex-1 px-2.5 py-1.5',
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
                className="relative rounded-lg p-2 text-white/45 transition hover:bg-white/5 hover:text-white"
              >
                <Bell className="h-3.5 w-3.5" />
                {notifCount > 0 && (
                  <div className="absolute right-0.5 top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold text-slate-950">
                    {notifCount > 9 ? '9+' : notifCount}
                  </div>
                )}
              </button>
              {notifOpen && (
                <div className="absolute bottom-full left-0 z-[60] mb-1 w-80 overflow-hidden rounded-xl border border-white/10 bg-[#0C1822] shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)]">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <span className="text-sm font-semibold text-white">
                      {locale === 'es' ? 'Notificaciones' : locale === 'pt' ? 'Notificações' : 'Notifications'}
                    </span>
                    {notifCount > 0 && (
                      <button type="button" onClick={markAllNotifRead} className="text-xs text-amber-200 hover:underline">
                        {locale === 'es' ? 'Marcar leídas' : locale === 'pt' ? 'Marcar lidas' : 'Mark all read'}
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 divide-y divide-white/[0.06] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-white/35">
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
                            'cursor-pointer px-4 py-3 transition hover:bg-white/[0.04]',
                            !n.read && 'bg-amber-500/10',
                          )}
                        >
                          <p className="text-sm font-medium text-white">{n.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-white/45">{n.message}</p>
                          <p className="mt-1 text-[10px] text-white/30">
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
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-100">
                {getInitials(session?.user?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{session?.user?.name ?? ''}</p>
                <p className="truncate text-xs text-white/40">{session?.user?.email ?? ''}</p>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-white/35 transition hover:text-red-300"
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
              className="mt-1 flex w-full items-center justify-center rounded-lg py-2 text-white/35 transition hover:text-red-300"
              title={tr('auth.logout')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}

      <div className={cn('relative z-10 flex min-h-screen min-w-0 flex-1 flex-col transition-all', collapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#07111A]/70 px-4 py-3 backdrop-blur-md lg:hidden">
          <button type="button" onClick={() => setSidebarOpen(true)} className="text-white/70 hover:text-white">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-[family-name:var(--font-etholys-display)] text-xs font-bold tracking-wide text-white">
            FundHub
          </span>
          {activeCompany && (
            <div className="ml-auto flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
              <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: activeCompany?.color ?? '#d97706' }} />
              <span className="truncate">{activeCompany?.name ?? ''}</span>
            </div>
          )}
        </div>

        <main className={cn('fh-canvas min-w-0 flex-1 overflow-auto', pathname?.includes('/fundhub/proposals/editor') ? 'p-3 md:p-4' : 'p-4 md:p-6')}>
          <div className={cn('mx-auto', pathname?.includes('/fundhub/proposals/editor') ? 'max-w-[1400px]' : 'max-w-6xl')}>
            <SystemLicenseGate system="FUNDHUB">{children}</SystemLicenseGate>
          </div>
        </main>
      </div>
    </div>
  );
}
