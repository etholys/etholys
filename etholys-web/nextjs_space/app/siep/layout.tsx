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
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-3 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /></div>;
  }

  const topItems = [
    { href: '/siep', icon: LayoutDashboard, label: tr('nav.dashboard') },
  ];

  const navGroups: NavGroup[] = [
    {
      key: 'projects',
      label: locale === 'es' ? 'Proyectos' : locale === 'pt' ? 'Projetos' : 'Projects',
      icon: FolderKanban,
      items: [
        { href: '/siep/projects', icon: FolderKanban, label: tr('nav.projects') },
        { href: '/siep/import', icon: Sparkles, label: locale === 'es' ? 'Importar' : locale === 'pt' ? 'Importar' : 'Import' },
        { href: '/siep/portfolio', icon: PieChart, label: locale === 'es' ? 'Portafolio' : locale === 'pt' ? 'Portf\u00f3lio' : 'Portfolio' },
      ],
    },
    {
      key: 'execution',
      label: locale === 'es' ? 'Ejecuci\u00f3n' : locale === 'pt' ? 'Execu\u00e7\u00e3o' : 'Execution',
      icon: Sprout,
      items: [
        { href: '/siep/stakeholders', icon: Handshake, label: locale === 'es' ? 'Alianzas' : locale === 'pt' ? 'Alian\u00e7as' : 'Alliances' },
      ],
    },
  ];

  const bottomItems = [
    { href: '/siep/chat', icon: MessageCircle, label: 'Chat', badge: chatUnread > 0 ? chatUnread : undefined },
    { href: '/siep/reports', icon: BarChart3, label: tr('nav.reports') },
    { href: '/settings', icon: Settings, label: tr('nav.settings') },
  ];

  const activeCompany = companies?.find((c: any) => c?.id === activeCompanyId);

  const markAllNotifRead = () => {
    fetch('/api/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAllRead: true }) }).then(() => {
      setNotifCount(0);
      setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar — fixed position with internal scroll */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transform transition-all lg:translate-x-0 flex flex-col',
        collapsed ? 'w-16' : 'w-64',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Brand header */}
        <div className={cn('border-b border-gray-100 flex-shrink-0', collapsed ? 'p-2' : 'p-4')}>
          <div className="flex items-center justify-between">
            <Link href="/siep" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">S</div>
              {!collapsed && <span className="font-bold text-gray-900">SIEP <span className="text-indigo-600">PM</span></span>}
            </Link>
            <div className="flex items-center gap-1">
              <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition" title={collapsed ? 'Expandir' : 'Minimizar'}>
                {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
          </div>
          {!collapsed && (
            <Link href="/hub" className="mt-2 flex items-center gap-1.5 px-2 py-1 text-xs text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition">
              <ChevronDown className="w-3 h-3 rotate-90" />
              {locale === 'es' ? 'Volver al Hub' : locale === 'pt' ? 'Voltar ao Hub' : 'Back to Hub'}
            </Link>
          )}
        </div>

        {/* Company selector */}
        {!collapsed && companies.length > 0 && (<div className="p-3 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <button onClick={() => setCompanyMenuOpen(!companyMenuOpen)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-700 truncate">
                  {activeCompany ? activeCompany?.shortName : tr('company.allCompanies')}
                </span>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-gray-400 transition', companyMenuOpen && 'rotate-180')} />
            </button>
            {companyMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-50 py-1">
                <button onClick={() => { setActiveCompanyId(null); setCompanyMenuOpen(false); }} className={cn('w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2', !activeCompanyId && 'text-indigo-600 font-medium')}>
                  <div className="w-3 h-3 rounded-full bg-gray-400" />{tr('company.allCompanies')}
                </button>
                {(companies ?? []).map((c: any) => (
                  <button key={c?.id} onClick={() => { setActiveCompanyId(c?.id); setCompanyMenuOpen(false); }} className={cn('w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2', activeCompanyId === c?.id && 'text-indigo-600 font-medium')}>
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
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}>
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}

          <div className="pt-2 pb-1"><div className="h-px bg-gray-100" /></div>

          {navGroups.map(group => {
            const isOpen = openGroups[group.key] ?? false;
            const hasActiveChild = group.items.some(i => pathname === i.href || pathname?.startsWith(i.href + '/'));
            if (collapsed) {
              return group.items.map(item => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} title={item.label} className={cn(
                    'flex items-center justify-center px-2 py-2.5 rounded-lg text-sm transition',
                    isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                  hasActiveChild ? 'text-indigo-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                )}>
                  <div className="flex items-center gap-3">
                    <group.icon className="w-4.5 h-4.5" />
                    {group.label}
                  </div>
                  <ChevronRight className={cn('w-3.5 h-3.5 transition-transform duration-200', isOpen && 'rotate-90')} />
                </button>
                {isOpen && (
                  <div className="ml-3 pl-3 border-l border-gray-100 space-y-0.5 mt-0.5 mb-1">
                    {group.items.map(item => {
                      const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition',
                          isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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

          <div className="pt-2 pb-1"><div className="h-px bg-gray-100" /></div>

          {bottomItems.map(item => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} title={collapsed ? item.label : undefined} className={cn(
                'flex items-center rounded-lg text-sm font-medium transition',
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
        <div className={cn('border-t border-gray-100 flex-shrink-0', collapsed ? 'p-1.5' : 'p-3')}>
          {/* Language + Notifications row */}
          <div className={cn('flex items-center mb-2', collapsed ? 'flex-col gap-1' : 'gap-1')}>
            <button onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')} className={cn(
              'flex items-center gap-1.5 text-xs rounded-lg hover:bg-gray-100 transition text-gray-600',
              collapsed ? 'p-2 justify-center' : 'px-2.5 py-1.5 flex-1'
            )} title={collapsed ? `${locale?.toUpperCase()}` : undefined}>
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              {!collapsed && locale?.toUpperCase()}
            </button>
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600 relative">
                <Bell className="w-3.5 h-3.5" />
                {notifCount > 0 && <div className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{notifCount > 9 ? '9+' : notifCount}</div>}
              </button>
              {notifOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-80 bg-white rounded-xl shadow-lg border z-[60] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="text-sm font-semibold text-gray-900">Notificaciones</span>
                    {notifCount > 0 && (
                      <button onClick={markAllNotifRead} className="text-xs text-indigo-600 hover:underline">
                        Marcar todo le&iacute;do
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">Sin notificaciones</div>
                    ) : notifications.map(n => (
                      <div key={n.id} onClick={() => { if (n.link) router.push(n.link); if (!n.read) { fetch('/api/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }); } setNotifOpen(false); }} className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition ${!n.read ? 'bg-indigo-50/50' : ''}`}>
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleDateString('es-UY')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User info */}
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-2 mt-1">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {getInitials(session?.user?.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{session?.user?.name ?? ''}</p>
                <p className="text-xs text-gray-500 truncate">{session?.user?.email ?? ''}</p>
              </div>
              <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-gray-400 hover:text-red-500 transition" title={tr('auth.logout')}>
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          {collapsed && (
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex items-center justify-center w-full py-2 rounded-lg text-gray-400 hover:text-red-500 transition mt-1" title={tr('auth.logout')}>
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content — offset by sidebar width, NO top header */}
      <div className={cn('flex-1 flex flex-col min-h-screen min-w-0 transition-all', collapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        {/* Mobile-only top bar for hamburger */}
        <div className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 hover:text-gray-900"><Menu className="w-5 h-5" /></button>
          {activeCompany && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: (activeCompany?.color ?? '#4F46E5') + '15', color: activeCompany?.color ?? '#4F46E5' }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activeCompany?.color ?? '#4F46E5' }} />
              {activeCompany?.name ?? ''}
            </div>
          )}
        </div>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
