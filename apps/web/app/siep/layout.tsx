'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/app/providers';
import Link from 'next/link';
import {
  LayoutDashboard, FolderKanban, Building2, BarChart3,
  Settings, LogOut, Menu, X, ChevronDown, ChevronRight, Globe, Bell,
  DollarSign, MessageCircle, PieChart, Handshake, Sprout, PanelLeftClose, PanelLeftOpen, Sparkles
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useSiepT } from '@/lib/siep/use-siep-t';
import { SystemLicenseGate } from '@/components/hub/SystemLicenseGate';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { sysTheme } from '@/lib/system-shell';

const ACCENT = 'indigo' as const;

type NavGroup = {
  key: string;
  label: string;
  icon: any;
  items: { href: string; icon: any; label: string }[];
};

export default function SiepLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const pathname = usePathname();
  const { tr, locale, setLocale, activeCompanyId, setActiveCompanyId } = useApp();
  const st = useSiepT();
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
      fetch('/api/companies').then(r => r.json()).then(d => {
        setCompanies(d?.companies ?? []);
      }).catch(() => {});
      const fetchNotifs = () => {
        fetch('/api/notifications?limit=10').then(r => r.json()).then(d => {
          setNotifCount(d?.unreadCount ?? 0);
          setNotifications(d?.notifications ?? []);
        }).catch(() => {});
      };
      fetchNotifs();
      const fetchChatUnread = () => {
        fetch('/api/chat/unread').then(r => r.json()).then(d => {
          setChatUnread(d?.unreadCount ?? 0);
        }).catch(() => {});
      };
      fetchChatUnread();
      const interval = setInterval(() => { fetchNotifs(); fetchChatUnread(); }, 60000);
      return () => clearInterval(interval);
    }
  }, [status]);

  const groupRoutes: Record<string, string[]> = {
    projects: ['/siep/projects', '/siep/portfolio'],
    execution: ['/siep/stakeholders'],
  };

  useEffect(() => {
    for (const [key, routes] of Object.entries(groupRoutes)) {
      if (routes.some(r => pathname === r || pathname?.startsWith(r + '/'))) {
        setOpenGroups(prev => prev[key] ? prev : { ...prev, [key]: true });
        break;
      }
    }
  }, [pathname]);

  const toggleGroup = (key: string) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111A]">
        <div className={cn('h-8 w-8 animate-spin rounded-full border-2', sysTheme.spin[ACCENT])} />
      </div>
    );
  }

  const isProjectGuest = (session?.user as { siepAccessMode?: string } | undefined)?.siepAccessMode === 'project_guest';

  const topItems = isProjectGuest
    ? []
    : [{ href: '/siep', icon: LayoutDashboard, label: tr('nav.dashboard') }];

  const navGroups: NavGroup[] = isProjectGuest
    ? [
        {
          key: 'projects',
          label: st('siep.nav.projects'),
          icon: FolderKanban,
          items: [{ href: '/siep/projects', icon: FolderKanban, label: tr('nav.projects') }],
        },
      ]
    : [
        {
          key: 'projects',
          label: st('siep.nav.projects'),
          icon: FolderKanban,
          items: [
            { href: '/siep/projects', icon: FolderKanban, label: tr('nav.projects') },
            { href: '/siep/import', icon: Sparkles, label: st('siep.nav.import') },
            { href: '/siep/portfolio', icon: PieChart, label: st('siep.nav.portfolio') },
          ],
        },
        {
          key: 'execution',
          label: st('siep.nav.execution'),
          icon: Sprout,
          items: [{ href: '/siep/stakeholders', icon: Handshake, label: st('siep.nav.alliances') }],
        },
      ];

  const bottomItems = isProjectGuest
    ? []
    : [
        { href: '/siep/chat', icon: MessageCircle, label: 'Chat', badge: chatUnread > 0 ? chatUnread : undefined },
        { href: '/siep/reports', icon: BarChart3, label: tr('nav.reports') },
        { href: '/siep/settings', icon: Settings, label: tr('nav.settings') },
      ];

  const activeCompany = companies?.find((c: any) => c?.id === activeCompanyId);

  const markAllNotifRead = () => {
    fetch('/api/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAllRead: true }) }).then(() => {
      setNotifCount(0);
      setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    });
  };

  return (
    <div className={sysTheme.root} data-accent={ACCENT}>
      <SystemAtmosphere accent={ACCENT} />
      <aside className={cn(
        sysTheme.aside,
        collapsed ? 'w-16' : 'w-64',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className={cn('border-b border-white/10 flex-shrink-0', collapsed ? 'p-2' : 'p-4')}>
          <div className="flex items-center justify-between">
            <Link href="/siep" className="flex items-center gap-2">
              <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border', sysTheme.icon[ACCENT])}>
                <Sprout className="h-4 w-4" strokeWidth={1.75} />
              </div>
              {!collapsed && <span className={sysTheme.brand}>SIEP</span>}
            </Link>
            <div className="flex items-center gap-1">
              <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-white/35 hover:text-white hover:bg-white/5 transition" title={collapsed ? 'Expandir' : 'Minimizar'}>
                {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
          </div>
          {!collapsed && !isProjectGuest && (
            <Link href="/hub" className="mt-2 flex items-center gap-1.5 px-2 py-1 text-xs text-white/40 hover:text-indigo-200 hover:bg-white/5 rounded-md transition">
              <ChevronDown className="w-3 h-3 rotate-90" />
              {locale === 'es' ? 'Volver al Hub' : locale === 'pt' ? 'Voltar ao Hub' : 'Back to Hub'}
            </Link>
          )}
          {!collapsed && isProjectGuest && (
            <p className="mt-2 px-2 text-[11px] text-white/40">
              {locale === 'es'
                ? 'Acceso limitado al proyecto invitado'
                : locale === 'pt'
                  ? 'Acesso limitado ao projeto convidado'
                  : 'Limited access to invited project'}
            </p>
          )}
        </div>

        {/* Company selector — oculto para convidados de projeto */}
        {!collapsed && !isProjectGuest && companies.length > 0 && (<div className="p-3 border-b border-white/10 flex-shrink-0">
          <div className="relative">
            <button onClick={() => setCompanyMenuOpen(!companyMenuOpen)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition text-sm text-white/80">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-white/40" />
                <span className="font-medium truncate">
                  {activeCompany ? activeCompany?.shortName : tr('company.allCompanies')}
                </span>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-white/35 transition', companyMenuOpen && 'rotate-180')} />
            </button>
            {companyMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#0C1822] rounded-lg shadow-lg border border-white/10 z-50 py-1">
                <button onClick={() => { setActiveCompanyId(null); setCompanyMenuOpen(false); }} className={cn('w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-2', !activeCompanyId ? 'text-indigo-200 font-medium' : 'text-white/70')}>
                  <div className="w-3 h-3 rounded-full bg-white/30" />{tr('company.allCompanies')}
                </button>
                {(companies ?? []).map((c: any) => (
                  <button key={c?.id} onClick={() => { setActiveCompanyId(c?.id); setCompanyMenuOpen(false); }} className={cn('w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-2', activeCompanyId === c?.id ? 'text-indigo-200 font-medium' : 'text-white/70')}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c?.color ?? '#4F46E5' }} />{c?.shortName ?? ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>)}

        {/* Navigation — scrollable area */}
        <nav className={cn('flex-1 space-y-0.5 overflow-y-auto', collapsed ? 'p-1.5' : 'p-3')}>
          {topItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} title={collapsed ? item.label : undefined} className={cn(
                'flex items-center rounded-lg text-sm font-medium transition',
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                isActive ? sysTheme.active[ACCENT] : sysTheme.navIdle
              )}>
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}

          <div className="pt-2 pb-1"><div className="h-px bg-white/10" /></div>

          {navGroups.map(group => {
            const isOpen = openGroups[group.key] ?? false;
            const hasActiveChild = group.items.some(i => pathname === i.href || pathname?.startsWith(i.href + '/'));
            if (collapsed) {
              return group.items.map(item => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} title={item.label} className={cn(
                    'flex items-center justify-center px-2 py-2.5 rounded-lg text-sm transition',
                    isActive ? cn(sysTheme.active[ACCENT], 'font-medium') : sysTheme.navIdle
                  )}>
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                  </Link>
                );
              });
            }
            return (
              <div key={group.key}>
                <button onClick={() => toggleGroup(group.key)} className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition',
                  hasActiveChild ? sysTheme.muted[ACCENT] : 'text-white/35 hover:bg-white/[0.04] hover:text-white/70'
                )}>
                  <div className="flex items-center gap-3">
                    <group.icon className="w-4.5 h-4.5" />
                    {group.label}
                  </div>
                  <ChevronRight className={cn('w-3.5 h-3.5 transition-transform duration-200', isOpen && 'rotate-90')} />
                </button>
                {isOpen && (
                  <div className="ml-3 pl-3 border-l border-white/10 space-y-0.5 mt-0.5 mb-1">
                    {group.items.map(item => {
                      const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition',
                          isActive ? cn(sysTheme.active[ACCENT], 'font-medium') : sysTheme.navIdle
                        )}>
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

          <div className="pt-2 pb-1"><div className="h-px bg-white/10" /></div>

          {bottomItems.map(item => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} title={collapsed ? item.label : undefined} className={cn(
                'flex items-center rounded-lg text-sm font-medium transition',
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                isActive ? sysTheme.active[ACCENT] : sysTheme.navIdle
              )}>
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {(item as any).badge > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {(item as any).badge > 9 ? '9+' : (item as any).badge}
                    </div>
                  )}
                </div>
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section: Language, Notifications, Collapse, User */}
        <div className={cn('border-t border-white/10 flex-shrink-0', collapsed ? 'p-1.5' : 'p-3')}>
          <div className={cn('flex items-center mb-2', collapsed ? 'flex-col gap-1' : 'gap-1')}>
            <button onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')} className={cn(
              'flex items-center gap-1.5 text-xs rounded-lg hover:bg-white/5 transition text-white/45',
              collapsed ? 'p-2 justify-center' : 'px-2.5 py-1.5 flex-1'
            )} title={collapsed ? `${locale?.toUpperCase()}` : undefined}>
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              {!collapsed && locale?.toUpperCase()}
            </button>
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="p-2 rounded-lg hover:bg-white/5 transition text-white/45 relative">
                <Bell className="w-3.5 h-3.5" />
                {notifCount > 0 && <div className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 bg-indigo-400 text-slate-950 text-[9px] font-bold rounded-full flex items-center justify-center">{notifCount > 9 ? '9+' : notifCount}</div>}
              </button>
              {notifOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-80 bg-[#0C1822] rounded-xl shadow-lg border border-white/10 z-[60] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <span className="text-sm font-semibold text-white">Notificaciones</span>
                    {notifCount > 0 && (
                      <button onClick={markAllNotifRead} className="text-xs text-indigo-200 hover:underline">
                        Marcar todo le&iacute;do
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.06]">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-white/35">Sin notificaciones</div>
                    ) : notifications.map(n => (
                      <div key={n.id} onClick={() => { if (n.link) router.push(n.link); if (!n.read) { fetch('/api/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }); } setNotifOpen(false); }} className={`px-4 py-3 hover:bg-white/[0.04] cursor-pointer transition ${!n.read ? 'bg-indigo-500/10' : ''}`}>
                        <p className="text-sm font-medium text-white">{n.title}</p>
                        <p className="text-xs text-white/45 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-white/30 mt-1">{new Date(n.createdAt).toLocaleDateString('es-UY')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-2 mt-1">
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', sysTheme.avatar[ACCENT])}>
                {getInitials(session?.user?.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{session?.user?.name ?? ''}</p>
                <p className="text-xs text-white/40 truncate">{session?.user?.email ?? ''}</p>
              </div>
              <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-white/35 hover:text-red-300 transition" title={tr('auth.logout')}>
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          {collapsed && (
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex items-center justify-center w-full py-2 rounded-lg text-white/35 hover:text-red-300 transition mt-1" title={tr('auth.logout')}>
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className={cn('relative z-10 flex-1 flex flex-col min-h-screen min-w-0 transition-all', collapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        <div className="lg:hidden sticky top-0 z-30 bg-[#07111A]/70 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-white/70 hover:text-white"><Menu className="w-5 h-5" /></button>
          {activeCompany && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: (activeCompany?.color ?? '#4F46E5') + '15', color: activeCompany?.color ?? '#4F46E5' }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeCompany?.color ?? '#4F46E5' }} />
              {activeCompany?.name ?? ''}
            </div>
          )}
        </div>
        <main className="sys-canvas flex-1 p-4 md:p-6 overflow-auto">
          <SystemLicenseGate system="SIEP">{children}</SystemLicenseGate>
        </main>
      </div>
    </div>
  );
}
