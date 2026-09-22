'use client';

import type { ComponentType } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import type { Locale } from '@/lib/i18n';
import Link from 'next/link';
import {
  Layers, BarChart3, Sprout, HandCoins, GraduationCap, Cpu, Target, LayoutGrid, Scale,
  LogOut, Globe, ArrowRight, Lock, ExternalLink, BrainCircuit, Video, PenLine, CheckSquare,
  FlaskConical,
} from 'lucide-react';
import { isContextSetupMeaningful, type CompanyContextSetup } from '@/lib/company-context-setup';
import { StateLoading } from '@/components/ui/StateBlocks';
import { useLicensedSystems } from '@/hooks/useLicensedSystems';
import { resolveHubCardAccess } from '@/lib/hub-system-license';
import { useEnsureActiveCompany } from '@/hooks/useEnsureActiveCompany';
import { CompanyPicker } from '@/components/hub/CompanyPicker';

type HubEntry = {
  id: string;
  name: string;
  tagline: Record<Locale, string>;
  icon: ComponentType<{ className?: string }>;
  href: string;
  active: boolean;
  productTier?: 'advisor' | 'tool' | 'default';
};

const systems: HubEntry[] = [
  {
    id: 'advisor',
    name: 'Advisor',
    tagline: {
      es: 'Alertas y prioridades',
      pt: 'Alertas e prioridades',
      en: 'Alerts & priorities',
    },
    icon: BrainCircuit,
    href: '/hub/advisor',
    active: true,
    productTier: 'advisor',
  },
  {
    id: 'studio',
    name: 'Studio',
    tagline: {
      es: 'Documentos con IA',
      pt: 'Documentos com IA',
      en: 'AI documents',
    },
    icon: PenLine,
    href: '/hub/studio',
    active: true,
    productTier: 'tool',
  },
  {
    id: 'work',
    name: 'Work',
    tagline: {
      es: 'Tareas del equipo',
      pt: 'Tarefas da equipa',
      en: 'Team tasks',
    },
    icon: CheckSquare,
    href: '/hub/work',
    active: true,
    productTier: 'tool',
  },
  {
    id: 'meet',
    name: 'Meet',
    tagline: {
      es: 'Reuniones y videollamadas',
      pt: 'Reuniões e videochamadas',
      en: 'Meetings & video calls',
    },
    icon: Video,
    href: '/hub/meet',
    active: true,
    productTier: 'tool',
  },
  {
    id: 'carta',
    name: 'CARTA',
    tagline: {
      es: 'Gobernanza y aprobaciones',
      pt: 'Governança e aprovações',
      en: 'Governance & approvals',
    },
    icon: Scale,
    href: '/hub/carta',
    active: true,
    productTier: 'tool',
  },
  {
    id: 'atlas',
    name: 'ATLAS',
    tagline: {
      es: 'La casa — finanzas, personas, operación',
      pt: 'A casa — finanças, pessoas, operação',
      en: 'Home base — finance, people, operations',
    },
    icon: BarChart3,
    href: '/dashboard',
    active: true,
  },
  {
    id: 'siep',
    name: 'SIEP',
    tagline: {
      es: 'Programas y ejecución de proyectos',
      pt: 'Programas e execução de projetos',
      en: 'Programs and project execution',
    },
    icon: Sprout,
    href: '/siep',
    active: true,
  },
  {
    id: 'fundhub',
    name: 'FUNDHUB',
    tagline: {
      es: 'Fondos, convocatorias y propuestas',
      pt: 'Fundos, concursos e propostas',
      en: 'Funds, calls and proposals',
    },
    icon: HandCoins,
    href: '/hub/fundhub',
    active: true,
  },
  {
    id: 'nexus',
    name: 'NEXUS',
    tagline: {
      es: 'Desarrollo MIPYME con IA',
      pt: 'Desenvolvimento MIPYME com IA',
      en: 'MSME development with AI',
    },
    icon: GraduationCap,
    href: '/hub/nexus',
    active: true,
  },
  {
    id: 'forge',
    name: 'FORGE',
    tagline: {
      es: 'Formación, cursos y juegos',
      pt: 'Formação, cursos e jogos',
      en: 'Learning, courses and games',
    },
    icon: Cpu,
    href: '/hub/forge',
    active: true,
  },
  {
    id: 'prism',
    name: 'PRISM',
    tagline: {
      es: 'Inteligencia ejecutiva',
      pt: 'Inteligência executiva',
      en: 'Executive intelligence',
    },
    icon: Target,
    href: '/hub/prism',
    active: true,
  },
];

const TOOLS_IDS = new Set(['advisor', 'studio', 'meet', 'carta', 'work']);

function isEtholysTool(sys: HubEntry): boolean {
  return TOOLS_IDS.has(sys.id) || sys.productTier === 'advisor' || sys.productTier === 'tool';
}

function pickLocalized(row: Record<Locale, string>, locale: Locale): string {
  return row[locale] ?? row.es;
}

function t(locale: Locale, es: string, pt: string, en: string) {
  return locale === 'pt' ? pt : locale === 'en' ? en : es;
}

export default function HubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale, setLocale, activeCompanyId } = useApp();
  const { companies, companiesReady, companiesLoadError, companyId, setActiveCompanyId, reloadCompanies } =
    useEnsureActiveCompany();
  const {
    licensedSystems,
    companyLicensedSystems,
    canManage,
    showIntegratedWorkspace,
    loading: accessLoading,
  } = useLicensedSystems(activeCompanyId);
  const [setupNudge, setSetupNudge] = useState<null | 'missing' | 'currency-mismatch'>(null);
  const [showLabShortcut, setShowLabShortcut] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') {
      setShowLabShortcut(false);
      return;
    }
    let cancelled = false;
    fetch('/api/lab/access')
      .then((r) => r.json())
      .then((d: { isSystemAdmin?: boolean }) => {
        if (!cancelled) setShowLabShortcut(Boolean(d.isSystemAdmin));
      })
      .catch(() => {
        if (!cancelled) setShowLabShortcut(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.email]);

  useEffect(() => {
    let cancelled = false;
    async function loadContextFlags() {
      if (!companyId) {
        if (!cancelled) setSetupNudge(null);
        return;
      }
      try {
        const r = await fetch(`/api/companies/setup?companyId=${encodeURIComponent(companyId)}`);
        if (!r.ok) return;
        const d = (await r.json()) as {
          company?: { contextSetupJson?: unknown; contextSetupAt?: string | null; currency?: string | null };
        };
        const raw = d.company?.contextSetupJson;
        if (!raw || typeof raw !== 'object') {
          if (!cancelled) setSetupNudge('missing');
          return;
        }

        const ctx = raw as CompanyContextSetup;
        const currencyOp = String(ctx.currencyOp || '').trim().toUpperCase();
        const companyCurrency = String(d.company?.currency || '').trim().toUpperCase();

        let nudge: null | 'missing' | 'currency-mismatch' = null;
        if (!d.company?.contextSetupAt || !isContextSetupMeaningful(ctx)) {
          nudge = 'missing';
        } else if (currencyOp && companyCurrency && currencyOp !== companyCurrency) {
          nudge = 'currency-mismatch';
        }

        if (!cancelled) setSetupNudge(nudge);
      } catch {
        // Hub still loads if setup is temporarily unavailable.
      }
    }
    void loadContextFlags();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const u = session?.user as
      | { forgeAccessMode?: string; forgeHomePath?: string; platformAdmin?: boolean; role?: string }
      | undefined;
    if (u?.platformAdmin || u?.role === 'ADMIN') return;
    if (u?.forgeAccessMode === 'course_only') {
      const home = u.forgeHomePath;
      router.replace(home && home.startsWith('/') ? home : '/hub/forge/mis-cursos');
    }
  }, [status, session, router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="etholys-hub-bg min-h-screen px-4">
        <StateLoading className="h-full" />
      </div>
    );
  }

  const firstName = session?.user?.name?.split(' ')?.[0] || '';
  const toolCards = systems.filter(isEtholysTool);
  const systemCards = systems.filter((sys) => !isEtholysTool(sys));

  const tileOpen =
    'group relative flex min-h-[4.25rem] items-center gap-4 rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_28px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.05] transition duration-200 hover:-translate-y-0.5 hover:ring-teal-500/25 hover:shadow-[0_4px_16px_-4px_rgba(13,148,136,0.15),0_16px_40px_-16px_rgba(15,23,42,0.15)]';
  const tileMuted =
    'group flex min-h-[4.25rem] items-center gap-4 rounded-2xl bg-white/70 px-4 py-3.5 ring-1 ring-slate-900/[0.04]';
  const iconShell =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1C24] text-teal-300/90 shadow-inner transition duration-200 group-hover:bg-[#0B1C24] group-hover:text-teal-200';
  const iconShellMuted =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400';

  const renderTile = (sys: HubEntry) => {
    const Icon = sys.icon;
    const cardAccess = resolveHubCardAccess(sys.id, sys.active, licensedSystems, {
      canManage,
      loading: accessLoading,
      companyLicensedSystems,
    });

    if (cardAccess === 'locked') {
      return (
        <div key={sys.id} className={`${tileMuted} opacity-80`}>
          <div className={iconShellMuted}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-700">{sys.name}</p>
              <Lock className="h-3 w-3 shrink-0 text-amber-600/90" />
            </div>
            <p className="truncate text-xs text-slate-500">{pickLocalized(sys.tagline, locale)}</p>
          </div>
          <Link
            href={canManage ? `/hub/billing?sku=sys.${(sys.id || '').toUpperCase()}` : '/hub/admin'}
            className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-teal-800 ring-1 ring-teal-600/20 transition hover:bg-teal-50"
          >
            {canManage
              ? t(locale, 'Licencia', 'Licença', 'License')
              : t(locale, 'Pedir', 'Pedir', 'Request')}
          </Link>
        </div>
      );
    }

    if (cardAccess === 'open') {
      return (
        <Link key={sys.id} href={sys.href} className={tileOpen}>
          <div className={iconShell}>
            <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-[family-name:var(--font-etholys-display)] text-[0.9375rem] font-semibold tracking-tight text-[#0B1C24]">
              {sys.name}
            </p>
            <p className="truncate text-xs leading-relaxed text-slate-500">{pickLocalized(sys.tagline, locale)}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600" />
        </Link>
      );
    }

    return (
      <div key={sys.id} className={`${tileMuted} opacity-55`}>
        <div className={iconShellMuted}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-600">{sys.name}</p>
            <Lock className="h-3 w-3 shrink-0 text-slate-400" />
          </div>
          <p className="truncate text-xs text-slate-400">{pickLocalized(sys.tagline, locale)}</p>
        </div>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-slate-400">
          {t(locale, 'Pronto', 'Em breve', 'Soon')}
        </span>
      </div>
    );
  };

  return (
    <div className="etholys-hub-bg min-h-screen text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-900/[0.06] bg-white/75 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1C24] shadow-sm">
              <Layers className="h-4 w-4 text-teal-400" />
            </div>
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-etholys-display)] text-sm font-bold tracking-[0.14em] text-[#0B1C24]">
                ETHOLYS
              </p>
            </div>
            <CompanyPicker
              companies={companies}
              activeCompanyId={companyId}
              onSelect={setActiveCompanyId}
              ready={companiesReady}
              error={companiesLoadError}
              onRetry={() => void reloadCompanies()}
              locale={locale}
              className="ml-1 max-w-[9.5rem] sm:ml-2 sm:max-w-none"
            />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <Globe className="h-3.5 w-3.5" />
              {locale?.toUpperCase()}
            </button>
            {canManage && (
              <Link
                href="/hub/setup"
                className="hidden rounded-md px-2 py-1.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:inline-flex"
              >
                {t(locale, 'Organización', 'Organização', 'Organization')}
              </Link>
            )}
            {canManage && (
              <Link
                href="/hub/billing"
                className="hidden rounded-md px-2 py-1.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:inline-flex"
              >
                {t(locale, 'Licencias', 'Licenças', 'Billing')}
              </Link>
            )}
            <Link
              href="/hub/admin"
              className="hidden rounded-md px-2 py-1.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:inline-flex"
            >
              {t(locale, 'Admin', 'Admin', 'Admin')}
            </Link>
            <Link
              href="https://etholys.com"
              className="hidden items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:inline-flex"
            >
              <ExternalLink className="h-3 w-3" />
              {t(locale, 'Sitio', 'Site', 'Site')}
            </Link>
            <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">
                {firstName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-slate-400 transition hover:text-red-500"
                title={t(locale, 'Cerrar sesión', 'Sair', 'Sign out')}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-etholys-display)] text-2xl font-semibold tracking-tight text-[#0B1C24] sm:text-[1.75rem]">
              {t(locale, `Hola, ${firstName}`, `Olá, ${firstName}`, `Hello, ${firstName}`)}
            </h1>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
              {t(locale, 'Abra un sistema o una herramienta.', 'Abra um sistema ou uma ferramenta.', 'Open a system or a tool.')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage && setupNudge && (
              <Link
                href="/hub/setup"
                className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-teal-800 ring-1 ring-teal-600/15 transition hover:bg-white"
              >
                {setupNudge === 'currency-mismatch'
                  ? t(locale, 'Actualizar perfil', 'Atualizar perfil', 'Update profile')
                  : t(locale, 'Completar perfil', 'Completar perfil', 'Complete profile')}
              </Link>
            )}
            {showIntegratedWorkspace && (
              <Link
                href="/hub/workspace"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-900/8 transition hover:bg-white hover:text-[#0B1C24]"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {t(locale, 'Centro integrado', 'Centro integrado', 'Integrated workspace')}
              </Link>
            )}
            {showLabShortcut && (
              <Link
                href="/lab"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-900/8 transition hover:bg-white"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Lab
              </Link>
            )}
          </div>
        </div>

        {systemCards.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 font-[family-name:var(--font-etholys-display)] text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t(locale, 'Sistemas', 'Sistemas', 'Systems')}
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {systemCards.map(renderTile)}
            </div>
          </section>
        )}

        {toolCards.length > 0 && (
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-etholys-display)] text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Etholys Tools
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {toolCards.map(renderTile)}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
