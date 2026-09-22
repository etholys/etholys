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
  accent: string;
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
    accent: '#7C3AED',
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
    accent: '#EA580C',
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
    accent: '#0D9488',
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
    accent: '#0284C7',
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
    accent: '#475569',
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
    accent: '#0D9488',
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
    accent: '#4F46E5',
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
    accent: '#D97706',
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
    accent: '#2563EB',
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
    accent: '#7C3AED',
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
    accent: '#E11D48',
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
      <div className="min-h-screen bg-[#F4F6F8] px-4">
        <StateLoading className="h-full" />
      </div>
    );
  }

  const firstName = session?.user?.name?.split(' ')?.[0] || '';
  const toolCards = systems.filter(isEtholysTool);
  const systemCards = systems.filter((sys) => !isEtholysTool(sys));

  const renderTile = (sys: HubEntry) => {
    const Icon = sys.icon;
    const cardAccess = resolveHubCardAccess(sys.id, sys.active, licensedSystems, {
      canManage,
      loading: accessLoading,
      companyLicensedSystems,
    });

    const baseClass =
      'group flex h-full min-h-[4.5rem] items-center gap-3 border border-[#E2E8F0] bg-white px-4 py-3 transition';

    if (cardAccess === 'locked') {
      return (
        <div key={sys.id} className={`${baseClass} opacity-70`}>
          <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: sys.accent, opacity: 0.35 }} />
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{ background: `${sys.accent}14`, color: sys.accent, opacity: 0.55 }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-700">{sys.name}</p>
              <Lock className="h-3 w-3 shrink-0 text-amber-600" />
            </div>
            <p className="truncate text-xs text-slate-400">{pickLocalized(sys.tagline, locale)}</p>
          </div>
          <Link
            href={canManage ? `/hub/billing?sku=sys.${(sys.id || '').toUpperCase()}` : '/hub/admin'}
            className="shrink-0 text-xs font-medium text-teal-700 hover:underline"
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
        <Link
          key={sys.id}
          href={sys.href}
          className={`${baseClass} hover:border-slate-300 hover:bg-[#FAFBFC]`}
        >
          <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: sys.accent }} />
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{ background: `${sys.accent}18`, color: sys.accent }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{sys.name}</p>
            <p className="truncate text-xs text-slate-500">{pickLocalized(sys.tagline, locale)}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
        </Link>
      );
    }

    return (
      <div key={sys.id} className={`${baseClass} opacity-50`}>
        <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: sys.accent, opacity: 0.3 }} />
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
          style={{ background: `${sys.accent}12`, color: sys.accent, opacity: 0.5 }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-600">{sys.name}</p>
            <Lock className="h-3 w-3 shrink-0 text-slate-400" />
          </div>
          <p className="truncate text-xs text-slate-400">{pickLocalized(sys.tagline, locale)}</p>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
          {t(locale, 'Pronto', 'Em breve', 'Soon')}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#0B1C24]">
              <Layers className="h-4 w-4 text-teal-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-[0.12em] text-slate-900">ETHOLYS</p>
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

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {t(locale, `Hola, ${firstName}`, `Olá, ${firstName}`, `Hello, ${firstName}`)}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t(locale, 'Abra un sistema o una herramienta.', 'Abra um sistema ou uma ferramenta.', 'Open a system or a tool.')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {canManage && setupNudge && (
              <Link href="/hub/setup" className="font-medium text-teal-700 hover:underline">
                {setupNudge === 'currency-mismatch'
                  ? t(locale, 'Actualizar perfil', 'Atualizar perfil', 'Update profile')
                  : t(locale, 'Completar perfil', 'Completar perfil', 'Complete profile')}
              </Link>
            )}
            {showIntegratedWorkspace && (
              <Link
                href="/hub/workspace"
                className="inline-flex items-center gap-1.5 font-medium text-slate-700 transition hover:text-teal-700"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {t(locale, 'Centro integrado', 'Centro integrado', 'Integrated workspace')}
              </Link>
            )}
            {showLabShortcut && (
              <Link
                href="/lab"
                className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition hover:text-violet-700"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Lab
              </Link>
            )}
          </div>
        </div>

        {systemCards.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {t(locale, 'Sistemas', 'Sistemas', 'Systems')}
              </h2>
              <p className="text-xs text-slate-400">
                {t(locale, 'Productos licenciables', 'Produtos licenciáveis', 'Licensable products')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {systemCards.map(renderTile)}
            </div>
          </section>
        )}

        {toolCards.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Etholys Tools
              </h2>
              <p className="text-xs text-slate-400">
                {t(locale, 'Herramientas transversales', 'Ferramentas transversais', 'Cross-cutting tools')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {toolCards.map(renderTile)}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
