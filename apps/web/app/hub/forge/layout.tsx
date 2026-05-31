'use client';

import { useEffect, useState } from 'react';
import { ForgeNotificationsBell } from '@/components/forge/ForgeNotificationsBell';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/app/providers';
import Link from 'next/link';
import {
  LayoutDashboard,
  GraduationCap,
  Trophy,
  Award,
  Route,
  LogOut,
  Menu,
  Building2,
  UserCircle,
  Map,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import type { ForgeAccessContext } from '@/lib/forge/access-context-shared';
import {
  defaultRedirectForCourseOnly,
  isPathAllowedForCourseOnly,
} from '@/lib/forge/access-context-shared';
import { isPublicForgePath } from '@/lib/forge/public-paths';
import { forgeCourseEntryPath, isForgeSalaPath } from '@/lib/forge/course-entry-path';
import { showsLiveFeatures } from '@/lib/forge/delivery';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { ForgeLocaleSwitcher } from '@/components/forge/ForgeLocaleSwitcher';

const fg = {
  grad: 'from-slate-900 via-blue-950 to-indigo-900',
  activeBg: 'bg-blue-50',
  activeText: 'text-blue-900',
  hoverHub: 'hover:text-blue-700 hover:bg-blue-50',
  avatar: 'bg-blue-100 text-blue-900',
  spin: 'border-blue-600/30 border-t-blue-600',
};

export default function ForgeLayout({ children }: { children: React.ReactNode }) {
  const ft = useForgeT();
  const orgNav = [
    { href: '/hub/forge', icon: LayoutDashboard, label: ft('forge.nav.overview') },
    { href: '/hub/forge/mi-cuenta', icon: UserCircle, label: ft('forge.nav.account') },
    { href: '/hub/forge/cursos', icon: GraduationCap, label: ft('forge.nav.courses') },
    { href: '/hub/forge/trilhas', icon: Route, label: ft('forge.nav.trails') },
    { href: '/hub/forge/gamificacao', icon: Trophy, label: ft('forge.nav.gamification') },
    { href: '/hub/forge/certificados', icon: Award, label: ft('forge.nav.certificates') },
  ];
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { activeCompanyId, setActiveCompanyId } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; shortName: string; color?: string }[]>([]);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [accessCtx, setAccessCtx] = useState<ForgeAccessContext | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);

  const isCourseOnly = accessCtx?.mode === 'course_only';
  const isPublicForge = pathname ? isPublicForgePath(pathname) : false;
  const isSalaImmersive = pathname ? isForgeSalaPath(pathname) : false;

  useEffect(() => {
    if (status === 'unauthenticated' && !isPublicForge) router.replace('/login');
  }, [status, router, isPublicForge]);

  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"][data-forge]');
    if (!link) {
      const el = document.createElement('link');
      el.rel = 'manifest';
      el.href = '/forge-pwa.json';
      el.setAttribute('data-forge', '1');
      document.head.appendChild(el);
    }
    let meta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'apple-mobile-web-app-capable');
      meta.setAttribute('content', 'yes');
      document.head.appendChild(meta);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    setAccessLoading(true);
    fetch('/api/forge/access-context')
      .then((r) => r.json())
      .then((d) => setAccessCtx(d))
      .catch(() => setAccessCtx(null))
      .finally(() => setAccessLoading(false));
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated' || !isCourseOnly || !accessCtx) return;
    if (!pathname) return;

    if (!isPathAllowedForCourseOnly(pathname, accessCtx.allowedCourseIds)) {
      router.replace(defaultRedirectForCourseOnly(accessCtx));
      return;
    }

    if (pathname === '/hub/forge' || pathname === '/hub/forge/cursos') {
      router.replace(defaultRedirectForCourseOnly(accessCtx));
    }
  }, [status, isCourseOnly, accessCtx, pathname, router]);

  useEffect(() => {
    if (status === 'authenticated' && !isCourseOnly) {
      fetch('/api/companies')
        .then((r) => r.json())
        .then((d) => setCompanies(d?.companies ?? []))
        .catch(() => {});
    }
  }, [status, isCourseOnly]);

  useEffect(() => {
    if (typeof window === 'undefined' || companies.length === 0) return;
    const fromUrl = new URLSearchParams(window.location.search).get('companyId');
    if (fromUrl && companies.some((c) => c.id === fromUrl) && fromUrl !== activeCompanyId) {
      setActiveCompanyId(fromUrl);
    }
  }, [companies, activeCompanyId, setActiveCompanyId]);

  if (isPublicForge) {
    if (status === 'loading') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className={cn('h-8 w-8 animate-spin rounded-full border-2', fg.spin)} />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex justify-end p-3">
          <ForgeLocaleSwitcher />
        </div>
        {children}
      </div>
    );
  }

  if (status === 'loading' || status === 'unauthenticated' || accessLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className={cn('h-8 w-8 animate-spin rounded-full border-2', fg.spin)} />
      </div>
    );
  }

  if (isSalaImmersive) {
    return <div className="min-h-dvh bg-slate-950">{children}</div>;
  }

  const singleLiveCourse =
    accessCtx?.courses.length === 1 &&
    showsLiveFeatures(accessCtx.courses[0].deliveryMode ?? 'async');

  const learnerNav = [
    {
      href: '/hub/forge/mis-cursos',
      icon: GraduationCap,
      label: accessCtx?.courses.length === 1 ? ft('forge.nav.myCourse') : ft('forge.nav.myCourses'),
    },
    {
      href: '/hub/forge/certificados',
      icon: Award,
      label: ft('forge.nav.certificates'),
    },
    ...(accessCtx?.courses.length === 1
      ? [
          {
            href: singleLiveCourse
              ? forgeCourseEntryPath(accessCtx.courses[0].id, accessCtx.courses[0].deliveryMode)
              : `/hub/forge/cursos/${accessCtx.courses[0].id}/mi-mapa`,
            icon: Map,
            label: singleLiveCourse ? ft('forge.nav.liveRoom') : ft('forge.nav.myMap'),
          },
        ]
      : []),
  ];

  const nav = isCourseOnly ? learnerNav : orgNav;
  const activeCompany = companies.find((c) => c.id === activeCompanyId);
  const q = activeCompanyId ? `?companyId=${encodeURIComponent(activeCompanyId)}` : '';

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="border-b border-gray-100 p-4">
          <Link
            href={isCourseOnly ? defaultRedirectForCourseOnly(accessCtx!) : '/hub/forge'}
            className="flex items-center gap-2"
          >
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white',
                fg.grad
              )}
            >
              F
            </div>
            <span className="font-bold text-gray-900">
              FOR<span className="text-blue-700">GE</span>
            </span>
          </Link>
          {isCourseOnly ? (
            <p className="mt-2 text-[10px] font-medium text-blue-800 bg-blue-50 rounded px-2 py-1">
              {ft('forge.layout.courseOnly')}
            </p>
          ) : (
            <Link
              href="/hub"
              className={cn('mt-2 block text-xs text-gray-500', fg.hoverHub, 'rounded px-2 py-1')}
            >
              {ft('forge.layout.backHub')}
            </Link>
          )}
        </div>

        {!isCourseOnly && companies.length > 0 && (
          <div className="border-b border-gray-100 p-3">
            <button
              type="button"
              onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
              className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 truncate">
                <Building2 className="h-4 w-4 text-gray-500" />
                {activeCompany?.shortName ?? 'Empresa'}
              </span>
            </button>
            {companyMenuOpen && (
              <div className="mt-1 rounded-lg border bg-white py-1 shadow-lg">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveCompanyId(c.id);
                      setCompanyMenuOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {c.shortName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  active ? cn(fg.activeBg, fg.activeText) : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2 px-2 py-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                fg.avatar
              )}
            >
              {getInitials(session?.user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{session?.user?.name}</p>
              <p className="truncate text-[10px] text-slate-500">{session?.user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-gray-400 hover:text-red-500"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-bold text-blue-800">FORGE</span>
          </div>
          <ForgeNotificationsBell />
        </div>
        <div className="hidden lg:flex absolute right-6 top-4 z-20 items-center gap-3">
          <ForgeLocaleSwitcher />
          <ForgeNotificationsBell />
        </div>
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl" data-forge-company-query={q}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
