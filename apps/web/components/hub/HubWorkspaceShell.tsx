'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { Layers, Globe, ExternalLink, LogOut, Building2, ChevronDown } from 'lucide-react';
import { cn, isLikelyDbId } from '@/lib/utils';

const TEAL = '#0d9488';

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
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const firstName = session?.user?.name?.split(' ')?.[0] || '';
  const activeCompany = companies.find((c) => c.id === activeCompanyId);

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
      const list: HubWorkspaceCompany[] = raw.map((c) => ({
        ...c,
        id: c?.id != null ? String(c.id) : '',
        shortName: c?.shortName ?? '—',
      })).filter((c) => c.id.length > 0);
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

  useEffect(() => {
    if (!companyMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setCompanyMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [companyMenuOpen]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
            <Link href="/hub" className="flex shrink-0 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-lg font-bold text-slate-800">ETHOLYS</span>
                <span className="ml-2 hidden text-xs text-slate-400 sm:inline">Hub</span>
              </div>
            </Link>
            <div className="hidden h-7 w-px bg-slate-200 sm:block" />

            <div ref={menuRef} className="relative min-w-[10rem] max-w-xs flex-1 sm:max-w-[220px]">
              {companiesReady && companies.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setCompanyMenuOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-left text-sm transition hover:border-teal-200 hover:bg-white"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="truncate font-medium text-slate-800">{activeCompany?.shortName || '—'}</span>
                    </span>
                    <ChevronDown
                      className={cn('h-4 w-4 shrink-0 text-slate-400 transition', companyMenuOpen && 'rotate-180')}
                    />
                  </button>
                  {companyMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      {companies.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setActiveCompanyId(String(c.id));
                            setCompanyMenuOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50',
                            activeCompanyId === c.id && 'bg-teal-50 font-medium text-teal-900'
                          )}
                        >
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: c.color || TEAL }}
                          />
                          <span className="truncate">{c.shortName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {companiesReady && companies.length === 0 && !companiesLoadError && (
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-900 hover:bg-teal-100"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {locale === 'es' ? 'Crear / unirse a empresa' : locale === 'pt' ? 'Criar / associar empresa' : 'Add / join company'}
                </Link>
              )}
              {companiesLoadError && (
                <p className="text-xs text-red-700" title={companiesLoadError}>
                  {locale === 'es' ? 'Error al cargar empresas' : locale === 'pt' ? 'Erro ao carregar empresas' : 'Error loading companies'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
            >
              <Globe className="h-3.5 w-3.5" />
              {locale?.toUpperCase()}
            </button>
            <Link
              href="/"
              className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 sm:flex"
            >
              <ExternalLink className="h-3 w-3" />
              {locale === 'es' ? 'Vitrina' : locale === 'pt' ? 'Vitrine' : 'Showcase'}
            </Link>
            <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                {firstName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span className="hidden text-sm text-slate-700 sm:inline">{firstName}</span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-slate-400 transition hover:text-red-500"
                title={locale === 'es' ? 'Cerrar sesión' : locale === 'pt' ? 'Sair' : 'Sign out'}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <div
        className="border-b border-slate-100 bg-slate-50/80 px-4 py-1.5 text-center text-[11px] text-slate-500 sm:px-6"
        style={{ display: companiesReady && companies.length > 0 ? 'block' : 'none' }}
      >
        {locale === 'es'
          ? 'Centro integrado: los datos viven en ATLAS, SIEP, FundHub, etc. El administrador asigna el acceso en Equipo.'
          : locale === 'pt'
            ? 'Centro integrado: os dados vivem no ATLAS, SIEP, FundHub, etc. O admin define o acesso em Equipa.'
            : 'Integrated workspace: data stays in ATLAS, SIEP, FundHub, etc. Admins set access in Team.'}
      </div>
      <HubWorkspaceRouteContext.Provider
        value={{
          companies,
          companiesReady,
          hasCompanies: companies.length > 0,
          companiesLoadError,
          reloadCompanies: loadCompanies,
        }}
      >
        {children}
      </HubWorkspaceRouteContext.Provider>
    </div>
  );
}
