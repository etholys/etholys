'use client';

import type { ComponentType } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import type { Locale } from '@/lib/i18n';
import Link from 'next/link';
import {
  Layers, BarChart3, Sprout, HandCoins, GraduationCap, Cpu, Target, LayoutGrid,
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
      es: 'Central de inteligencia y consejos institucionales',
      pt: 'Central de inteligência e conselhos institucionais',
      en: 'Institutional intelligence and advisory hub',
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
      es: 'Redacción y diagramación de documentos, vídeos y diseños',
      pt: 'Redação e diagramação de documentos, vídeos e desenhos',
      en: 'Writing and layout for documents, video and design',
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
      es: 'Gestor de tareas del equipo',
      pt: 'Gestor de tarefas da equipa',
      en: 'Team task manager',
    },
    icon: CheckSquare,
    href: '/hub/work',
    active: true,
    productTier: 'tool',
  },
  {
    id: 'meet',
    name: 'Chorus',
    tagline: {
      es: 'Reuniones y videollamadas, con transcripción y grabación',
      pt: 'Reuniões e videochamadas, com transcrição e gravação',
      en: 'Meetings and video calls, with transcription and recording',
    },
    icon: Video,
    href: '/hub/meet',
    active: true,
    productTier: 'tool',
  },
  {
    id: 'prism',
    name: 'PRISM',
    tagline: {
      es: 'Datos, progreso ESG y monitoreo de impacto',
      pt: 'Dados, progresso ESG e monitorização de impacto',
      en: 'Data, ESG progress and impact monitoring',
    },
    icon: Target,
    href: '/hub/prism',
    active: true,
    productTier: 'tool',
  },
  {
    id: 'atlas',
    name: 'ATLAS',
    tagline: {
      es: 'Gestión empresarial: planificación, finanzas, contabilidad, RRHH, proveedores, clientes e inventario',
      pt: 'Gestão empresarial: planeamento, finanças, contabilidade, RH, fornecedores, clientes e inventário',
      en: 'Business management: planning, finance, accounting, HR, suppliers, clients and inventory',
    },
    icon: BarChart3,
    href: '/dashboard',
    active: true,
  },
  {
    id: 'siep',
    name: 'SIEP',
    tagline: {
      es: 'Gestión de proyectos: portafolio, ejecución, evidencias y seguimiento',
      pt: 'Gestão de projetos: portefólio, execução, evidências e acompanhamento',
      en: 'Project management: portfolio, execution, evidence and tracking',
    },
    icon: Sprout,
    href: '/siep',
    active: true,
  },
  {
    id: 'fundhub',
    name: 'FundHub',
    tagline: {
      es: 'Captación de fondos, convocatorias y redacción de propuestas',
      pt: 'Captação de fundos, concursos e redação de propostas',
      en: 'Fundraising, calls for proposals and proposal writing',
    },
    icon: HandCoins,
    href: '/hub/fundhub',
    active: true,
  },
  {
    id: 'nexus',
    name: 'NEXUS',
    tagline: {
      es: 'Asistencia técnica para el desarrollo de negocios en distintas etapas de madurez',
      pt: 'Assistência técnica para desenvolvimento de negócios em distintas etapas de maturidade',
      en: 'Technical assistance for business development across maturity stages',
    },
    icon: GraduationCap,
    href: '/hub/nexus',
    active: true,
  },
  {
    id: 'forge',
    name: 'FORGE',
    tagline: {
      es: 'Creación y hospedaje de cursos virtuales — metodologías tradicionales o lúdicas (juegos)',
      pt: 'Criação e hospedagem de cursos virtuais — metodologias tradicionais ou lúdicas (jogos)',
      en: 'Create and host virtual courses — traditional or playful methods (games)',
    },
    icon: Cpu,
    href: '/hub/forge',
    active: true,
  },
];

/** Ferramentas transversais (PRISM deixou de ser sistema peer). */
const TOOLS_IDS = new Set(['advisor', 'studio', 'meet', 'work', 'prism']);

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
      <div className="flex min-h-screen items-center justify-center bg-[#07111A] px-4">
        <StateLoading className="h-full" />
      </div>
    );
  }

  const firstName = session?.user?.name?.split(' ')?.[0] || '';
  const toolCards = systems.filter(isEtholysTool);
  const systemCards = systems.filter((sys) => !isEtholysTool(sys));

  const renderRow = (sys: HubEntry, index: number) => {
    const Icon = sys.icon;
    const cardAccess = resolveHubCardAccess(sys.id, sys.active, licensedSystems, {
      canManage,
      loading: accessLoading,
      companyLicensedSystems,
    });

    const rowShell =
      'group flex items-center gap-4 px-4 py-4 transition sm:px-5 sm:py-[1.125rem]';

    if (cardAccess === 'locked') {
      return (
        <div
          key={sys.id}
          className={`${rowShell} opacity-70`}
          style={{ animationDelay: `${index * 45}ms` }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/40">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-[family-name:var(--font-etholys-display)] text-sm font-semibold tracking-wide text-white/70">
                {sys.name}
              </p>
              <Lock className="h-3 w-3 shrink-0 text-amber-400/80" />
            </div>
            <p className="truncate text-xs text-white/35">{pickLocalized(sys.tagline, locale)}</p>
          </div>
          <Link
            href={canManage ? `/hub/billing?sku=sys.${(sys.id || '').toUpperCase()}` : '/hub/admin'}
            className="shrink-0 rounded-md border border-teal-400/30 bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-200 transition hover:bg-teal-500/20"
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
          className={`${rowShell} hover:bg-white/[0.04]`}
          style={{ animationDelay: `${index * 45}ms` }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-teal-400/20 bg-teal-500/10 text-teal-300 transition group-hover:border-teal-400/40 group-hover:bg-teal-500/15 group-hover:text-teal-200">
            <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-[family-name:var(--font-etholys-display)] text-[0.95rem] font-semibold tracking-wide text-white">
              {sys.name}
            </p>
            <p className="truncate text-xs text-white/45 transition group-hover:text-white/60">
              {pickLocalized(sys.tagline, locale)}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-teal-300" />
        </Link>
      );
    }

    return (
      <div key={sys.id} className={`${rowShell} opacity-45`}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/30">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-[family-name:var(--font-etholys-display)] text-sm font-semibold text-white/55">
              {sys.name}
            </p>
            <Lock className="h-3 w-3 shrink-0 text-white/30" />
          </div>
          <p className="truncate text-xs text-white/30">{pickLocalized(sys.tagline, locale)}</p>
        </div>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-white/30">
          {t(locale, 'Pronto', 'Em breve', 'Soon')}
        </span>
      </div>
    );
  };

  return (
    <div className="etholys-hub relative isolate min-h-screen overflow-hidden bg-[#07111A] text-[#E8EEF2]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_10%,rgba(13,148,136,0.26),transparent_55%),radial-gradient(90%_70%_at_10%_90%,rgba(15,23,42,0.85),transparent_50%),linear-gradient(165deg,#041018_0%,#0B1C24_42%,#07111A_100%)]"
      />
      <div aria-hidden className="etholys-site-grid pointer-events-none absolute inset-0 opacity-[0.14]" />
      <div
        aria-hidden
        className="etholys-site-orbit pointer-events-none absolute -right-[22%] top-[-8%] h-[75vmin] w-[75vmin] rounded-full border border-teal-400/15"
      />
      <div
        aria-hidden
        className="etholys-site-orbit-slow pointer-events-none absolute -right-[10%] top-[12%] h-[48vmin] w-[48vmin] rounded-full border border-teal-300/10"
      />

      <header className="relative z-20 border-b border-white/10 bg-[#07111A]/55 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-400/25 bg-teal-500/10">
              <Layers className="h-4 w-4 text-teal-300" />
            </div>
            <p className="font-[family-name:var(--font-etholys-display)] text-sm font-bold tracking-[0.16em] text-white">
              ETHOLYS
            </p>
            <div className="hub-company-picker-dark ml-1 max-w-[9.5rem] sm:ml-2 sm:max-w-none">
              <CompanyPicker
                companies={companies}
                activeCompanyId={companyId}
                onSelect={setActiveCompanyId}
                ready={companiesReady}
                error={companiesLoadError}
                onRetry={() => void reloadCompanies()}
                locale={locale}
              />
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs uppercase tracking-wider text-white/50 transition hover:bg-white/5 hover:text-white"
            >
              <Globe className="h-3.5 w-3.5" />
              {locale?.toUpperCase()}
            </button>
            {canManage && (
              <Link
                href="/hub/setup"
                className="hidden rounded-md px-2 py-1.5 text-xs text-white/50 transition hover:bg-white/5 hover:text-white sm:inline-flex"
              >
                {t(locale, 'Organización', 'Organização', 'Organization')}
              </Link>
            )}
            {canManage && (
              <Link
                href="/hub/billing"
                className="hidden rounded-md px-2 py-1.5 text-xs text-white/50 transition hover:bg-white/5 hover:text-white sm:inline-flex"
              >
                {t(locale, 'Licencias', 'Licenças', 'Billing')}
              </Link>
            )}
            <Link
              href="/hub/admin"
              className="hidden rounded-md px-2 py-1.5 text-xs text-white/50 transition hover:bg-white/5 hover:text-white sm:inline-flex"
            >
              Admin
            </Link>
            <Link
              href="https://etholys.com"
              className="hidden items-center gap-1 rounded-md px-2 py-1.5 text-xs text-white/50 transition hover:bg-white/5 hover:text-white sm:inline-flex"
            >
              <ExternalLink className="h-3 w-3" />
              {t(locale, 'Sitio', 'Site', 'Site')}
            </Link>
            <div className="ml-1 flex items-center gap-2 border-l border-white/10 pl-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-200">
                {firstName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-white/40 transition hover:text-red-300"
                title={t(locale, 'Cerrar sesión', 'Sair', 'Sign out')}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <div className="etholys-site-rise mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-400/90">
            {t(locale, 'Hub', 'Hub', 'Hub')}
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-etholys-display)] text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            {t(locale, `Hola, ${firstName}`, `Olá, ${firstName}`, `Hello, ${firstName}`)}
          </h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-white/55">
            {t(
              locale,
              'Elija por dónde empezar. Un ecosistema, un acceso.',
              'Escolha por onde começar. Um ecossistema, um acesso.',
              'Choose where to start. One ecosystem, one access.',
            )}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {canManage && setupNudge && (
              <Link
                href="/hub/setup"
                className="rounded-md bg-teal-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-teal-400"
              >
                {setupNudge === 'currency-mismatch'
                  ? t(locale, 'Actualizar perfil', 'Atualizar perfil', 'Update profile')
                  : t(locale, 'Completar perfil', 'Completar perfil', 'Complete profile')}
              </Link>
            )}
            {showIntegratedWorkspace && (
              <Link
                href="/hub/workspace"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {t(locale, 'Centro integrado', 'Centro integrado', 'Integrated workspace')}
              </Link>
            )}
            {showLabShortcut && (
              <Link
                href="/lab"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3.5 py-1.5 text-xs font-medium text-white/55 transition hover:border-white/25 hover:text-white"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Lab
              </Link>
            )}
          </div>
        </div>

        <div className="etholys-site-rise grid gap-6 lg:grid-cols-[1.35fr_1fr]" style={{ animationDelay: '120ms' }}>
          {systemCards.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0C1822]/80 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h2 className="font-[family-name:var(--font-etholys-display)] text-xs font-semibold uppercase tracking-[0.2em] text-teal-400/90">
                  {t(locale, 'Sistemas', 'Sistemas', 'Systems')}
                </h2>
                <span className="text-[11px] text-white/35">
                  {systemCards.length} {t(locale, 'productos', 'produtos', 'products')}
                </span>
              </div>
              <div className="divide-y divide-white/[0.07]">
                {systemCards.map((sys, i) => renderRow(sys, i))}
              </div>
            </section>
          )}

          {toolCards.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0C1822]/55 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.7)] backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h2 className="font-[family-name:var(--font-etholys-display)] text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                  Etholys Tools
                </h2>
                <span className="text-[11px] text-white/30">
                  {toolCards.length}
                </span>
              </div>
              <div className="divide-y divide-white/[0.07]">
                {toolCards.map((sys, i) => renderRow(sys, i + systemCards.length))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
