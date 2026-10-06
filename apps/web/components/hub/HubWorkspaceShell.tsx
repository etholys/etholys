'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { Layers, Globe, LogOut } from 'lucide-react';
import { isLikelyDbId } from '@/lib/utils';
import { CompanyPicker } from '@/components/hub/CompanyPicker';
import { AppearanceToggle } from '@/components/hub/AppearanceToggle';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { sysTheme } from '@/lib/system-shell';

export type HubWorkspaceCompany = { id: string; shortName: string; name?: string; color?: string | null };

type HubWorkspaceRoute = {
  companies: HubWorkspaceCompany[];
  companiesReady: boolean;
  hasCompanies: boolean;
  companiesLoadError: string | null;
  reloadCompanies: () => void;
};

const HubWorkspaceRouteContext = createContext<HubWorkspaceRoute>({
  companies: [],
  companiesReady: false,
  hasCompanies: false,
  companiesLoadError: null,
  reloadCompanies: () => {},
});

export function useHubWorkspaceRoute() {
  return useContext(HubWorkspaceRouteContext);
}

export function HubWorkspaceShell({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale, setLocale, activeCompanyId, setActiveCompanyId } = useApp();
  const activeCompanyIdRef = useRef<string | null>(activeCompanyId);
  activeCompanyIdRef.current = activeCompanyId;
  const [companies, setCompanies] = useState<HubWorkspaceCompany[]>([]);
  const [companiesReady, setCompaniesReady] = useState(false);
  const [companiesLoadError, setCompaniesLoadError] = useState<string | null>(null);
  const firstName = session?.user?.name?.split(' ')?.[0] || '';

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  const loadCompanies = useCallback(async () => {
    setCompaniesLoadError(null);
    setCompaniesReady(false);
    if (status !== 'authenticated' || !session?.user) {
      setCompaniesReady(true);
      return;
    }
    try {
      const r = await fetch('/api/companies', { cache: 'no-store', credentials: 'include' });
      const d = (await r.json()) as { companies?: HubWorkspaceCompany[]; error?: string };
      if (!r.ok) {
        setCompaniesLoadError(typeof d?.error === 'string' ? d.error : `HTTP ${r.status}`);
        setCompanies([]);
        setActiveCompanyId(null);
        return;
      }
      const raw = Array.isArray(d?.companies) ? d.companies : [];
      const list: HubWorkspaceCompany[] = raw
        .map((c) => ({
          ...c,
          id: c?.id != null ? String(c.id) : '',
          shortName: c?.shortName ?? '—',
        }))
        .filter((c) => c.id.length > 0);
      setCompanies(list);
      if (list.length === 0) {
        setActiveCompanyId(null);
        return;
      }
      const cur = activeCompanyIdRef.current;
      const prevStr = cur == null ? null : String(cur);
      const inList = prevStr && list.some((c) => c.id === prevStr);
      if (inList && isLikelyDbId(prevStr)) {
        setActiveCompanyId(prevStr);
      } else {
        const fid = list[0].id;
        setActiveCompanyId(isLikelyDbId(fid) ? fid : null);
      }
    } catch (e) {
      setCompaniesLoadError(e instanceof Error ? e.message : 'Falha de rede');
      setCompanies([]);
      setActiveCompanyId(null);
    } finally {
      setCompaniesReady(true);
    }
  }, [setActiveCompanyId, status, session?.user]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    void loadCompanies();
  }, [status, session?.user, loadCompanies]);

  /** Atalho documentado: Alt+Shift+W → Centro (evita conflito com F11 fullscreen). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        router.push('/hub/workspace');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111A]">
        <div className={sysTheme.spin.teal + ' h-8 w-8 animate-spin rounded-full border-2'} />
      </div>
    );
  }

  return (
    <div className={sysTheme.root} data-accent="teal">
      <SystemAtmosphere accent="teal" />
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-40 border-b border-[color:var(--sys-line,rgba(255,255,255,0.1))] bg-[color:var(--sys-aside-bg,rgba(7,17,26,0.88))] backdrop-blur-md">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
              <Link href="/hub" className="flex shrink-0 items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${sysTheme.icon.teal}`}>
                  <Layers className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <span className={sysTheme.brand}>ETHOLYS</span>
                  <span className="ml-2 hidden text-xs font-medium text-[color:var(--sys-muted,rgba(255,255,255,0.45))] sm:inline">
                    Hub
                  </span>
                </div>
              </Link>
              <div className="hidden h-7 w-px bg-[color:var(--sys-line,rgba(255,255,255,0.1))] sm:block" />
              <CompanyPicker
                companies={companies}
                activeCompanyId={activeCompanyId ? String(activeCompanyId) : ''}
                onSelect={(id) => setActiveCompanyId(id)}
                ready={companiesReady}
                error={companiesLoadError}
                onRetry={() => void loadCompanies()}
                tone="dark"
                locale={locale}
                className="min-w-[10rem] max-w-xs flex-1 sm:max-w-[220px]"
              />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-white/55 transition hover:bg-white/5 hover:text-white"
              >
                <Globe className="h-3.5 w-3.5" />
                {locale?.toUpperCase()}
              </button>
              <AppearanceToggle collapsed className="!w-auto" />
              <div className="ml-1 flex items-center gap-2 border-l border-white/10 pl-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${sysTheme.avatar.teal}`}>
                  {firstName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span className="hidden text-sm text-white/70 sm:inline">{firstName}</span>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-white/40 transition hover:text-red-300"
                  title={locale === 'es' ? 'Cerrar sesión' : locale === 'pt' ? 'Sair' : 'Sign out'}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </header>
        <HubWorkspaceRouteContext.Provider
          value={{
            companies,
            companiesReady,
            hasCompanies: companies.length > 0,
            companiesLoadError,
            reloadCompanies: loadCompanies,
          }}
        >
          <div className="sys-canvas flex min-h-0 flex-1 flex-col">{children}</div>
        </HubWorkspaceRouteContext.Provider>
      </div>
    </div>
  );
}
