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

const systems: Array<{
  id: string;
  name: string;
  tagline: { es: string; pt: string; en: string };
  description: { es: string; pt: string; en: string };
  icon: ComponentType<{ className?: string }>;
  color: string;
  borderColor: string;
  bgHover: string;
  href: string;
  active: boolean;
  productTier?: 'advisor' | 'tool' | 'default';
}> = [
  {
    id: 'advisor',
    name: 'Etholys AI Advisor',
    tagline: {
      es: 'Alertas y prioridades',
      pt: 'Alertas e prioridades',
      en: 'Alerts & priorities',
    },
    description: {
      es: 'Alertas, res\u00famenes y prioridades a partir de los datos de sus sistemas.',
      pt: 'Alertas, resumos e prioridades a partir dos dados dos seus sistemas.',
      en: 'Alerts, digests, and priorities from your systems\u2019 data.',
    },
    icon: BrainCircuit,
    color: 'from-violet-600 to-fuchsia-700',
    borderColor: 'border-violet-300',
    bgHover: 'hover:border-violet-400 hover:shadow-violet-100',
    href: '/hub/advisor',
    active: true,
    productTier: 'advisor',
  },
  {
    id: 'studio',
    name: 'Etholys Studio',
    tagline: {
      es: 'Documentos con IA',
      pt: 'Documentos com IA',
      en: 'AI documents',
    },
    description: {
      es: 'Carpetas, plantillas, canvas y chat para redactar informes, propuestas y diagramas.',
      pt: 'Pastas, modelos, canvas e chat para redigir relatórios, propostas e diagramas.',
      en: 'Folders, templates, canvas, and chat for reports, proposals, and diagrams.',
    },
    icon: PenLine,
    color: 'from-orange-500 to-amber-600',
    borderColor: 'border-orange-300',
    bgHover: 'hover:border-orange-400 hover:shadow-orange-100',
    href: '/hub/studio',
    active: true,
    productTier: 'tool',
  },
  {
    id: 'work',
    name: 'Etholys Work',
    tagline: {
      es: 'Tareas del equipo',
      pt: 'Tarefas da equipa',
      en: 'Team tasks',
    },
    description: {
      es: 'Kanban, lista, grupos, subtareas y tiempo para el trabajo del equipo.',
      pt: 'Kanban, lista, grupos, subtarefas e tempo para o trabalho da equipa.',
      en: 'Kanban, list, groups, subtasks, and time tracking for the team.',
    },
    icon: CheckSquare,
    color: 'from-cyan-500 to-teal-700',
    borderColor: 'border-cyan-300',
    bgHover: 'hover:border-cyan-400 hover:shadow-cyan-100',
    href: '/hub/work',
    active: true,
    productTier: 'tool',
  },
  {
    id: 'atlas',
    name: 'ATLAS',
    tagline: { es: 'ERP 360\u00b0', pt: 'ERP 360\u00b0', en: 'ERP 360\u00b0' },
    description: {
      es: 'Gesti\u00f3n institucional y empresarial: finanzas, RRHH, inventario, facturaci\u00f3n y operaciones.',
      pt: 'Gest\u00e3o institucional e empresarial: finan\u00e7as, RH, estoque, fatura\u00e7\u00e3o e opera\u00e7\u00f5es.',
      en: 'Institutional & business management: finance, HR, inventory, invoicing, and operations.',
    },
    icon: BarChart3,
    color: 'from-teal-500 to-emerald-600',
    borderColor: 'border-teal-200',
    bgHover: 'hover:border-teal-400 hover:shadow-teal-100',
    href: '/dashboard',
    active: true,
  },
  {
    id: 'siep',
    name: 'SIEP',
    tagline: {
      es: 'Ejecuci\u00f3n e innovaci\u00f3n de proyectos',
      pt: 'Execu\u00e7\u00e3o e inova\u00e7\u00e3o de projetos',
      en: 'Project execution & innovation',
    },
    description: {
      es: 'Portafolio, ejecuci\u00f3n, stakeholders, marco l\u00f3gico y monitoreo de proyectos de cooperaci\u00f3n e innovaci\u00f3n.',
      pt: 'Portf\u00f3lio, execu\u00e7\u00e3o, stakeholders, marco l\u00f3gico e monitoriza\u00e7\u00e3o de projetos de coopera\u00e7\u00e3o e inova\u00e7\u00e3o.',
      en: 'Portfolio, delivery, stakeholders, logical framework, and monitoring for cooperation and innovation projects.',
    },
    icon: Sprout,
    color: 'from-indigo-500 to-blue-600',
    borderColor: 'border-indigo-200',
    bgHover: 'hover:border-indigo-400 hover:shadow-indigo-100',
    href: '/siep',
    active: true,
  },
  {
    id: 'fundhub',
    name: 'FUNDHUB',
    tagline: { es: 'Captaci\u00f3n y red', pt: 'Capta\u00e7\u00e3o e rede', en: 'Funding & network' },
    description: {
      es: 'Oportunidades, propuestas, socios locales y cumplimiento \u2014 m\u00e1s que un buscador de fondos.',
      pt: 'Oportunidades, propostas, parceiros locais e compliance \u2014 mais do que um buscador de fundos.',
      en: 'Opportunities, proposals, local partners, and compliance \u2014 beyond a grant finder.',
    },
    icon: HandCoins,
    color: 'from-amber-500 to-orange-600',
    borderColor: 'border-amber-200',
    bgHover: 'hover:border-amber-300',
    href: '/hub/fundhub',
    active: true,
  },
  {
    id: 'nexus',
    name: 'NEXUS',
    tagline: { es: 'Desarrollo MIPYME', pt: 'Desenvolvimento MIPYME', en: 'MIPYME development' },
    description: {
      es: 'Diagn\u00f3stico 360\u00b0, ruta de desarrollo, asistencia t\u00e9cnica h\u00edbrida y copiloto para MIPYMEs de todos los sectores.',
      pt: 'Diagn\u00f3stico 360\u00b0, rota de desenvolvimento, assist\u00eancia t\u00e9cnica h\u00edbrida e copiloto para MIPYMEs de todos os setores.',
      en: '360\u00b0 diagnosis, development roadmap, hybrid technical assistance, and copilot for MSMEs across all sectors.',
    },
    icon: GraduationCap,
    color: 'from-blue-500 to-indigo-600',
    borderColor: 'border-blue-200',
    bgHover: 'hover:border-blue-300',
    href: '/hub/nexus',
    active: true,
  },
  {
    id: 'forge',
    name: 'FORGE',
    tagline: { es: 'EAD / LMS', pt: 'EAD / LMS', en: 'EAD / LMS' },
    description: {
      es: 'Cursos, aulas, cuestionarios, juegos y gamificaci\u00f3n.',
      pt: 'Cursos, aulas, quizzes, jogos e gamifica\u00e7\u00e3o.',
      en: 'Courses, lessons, quizzes, games, and gamification.',
    },
    icon: Cpu,
    color: 'from-violet-500 to-purple-600',
    borderColor: 'border-violet-200',
    bgHover: 'hover:border-violet-300',
    href: '/hub/forge',
    active: true,
  },
  {
    id: 'prism',
    name: 'PRISM',
    tagline: { es: 'BI 360\u00b0', pt: 'BI 360\u00b0', en: 'BI 360\u00b0' },
    description: {
      es: 'Panel ejecutivo e inteligencia de datos: dashboards cruzados, an\u00e1lisis predictivo e indicadores de impacto (incl. ESG).',
      pt: 'Painel executivo e intelig\u00eancia de dados: dashboards cruzados, an\u00e1lise preditiva e indicadores de impacto (incl. ESG).',
      en: 'Executive panel & data intelligence: cross-system dashboards, predictive analysis, and impact indicators (incl. ESG).',
    },
    icon: Target,
    color: 'from-rose-500 to-pink-600',
    borderColor: 'border-rose-200',
    bgHover: 'hover:border-rose-300',
    href: '/hub/prism',
    active: true,
  },
  {
    id: 'carta',
    name: 'CARTA',
    tagline: {
      es: 'Gobernanza y aprobaciones',
      pt: 'Governan\u00e7a e aprova\u00e7\u00f5es',
      en: 'Governance & approvals',
    },
    description: {
      es: 'Aprobaciones y decisiones con rastro en toda la organizaci\u00f3n.',
      pt: 'Aprova\u00e7\u00f5es e decis\u00f5es com rasto em toda a organiza\u00e7\u00e3o.',
      en: 'Approvals and decisions with a trail across the organization.',
    },
    icon: Scale,
    color: 'from-slate-600 to-slate-800',
    borderColor: 'border-slate-300',
    bgHover: 'hover:border-slate-500 hover:shadow-slate-100/80',
    href: '/hub/carta',
    active: true,
    productTier: 'tool',
  },
  {
    id: 'meet',
    name: 'Etholys Meet',
    tagline: {
      es: 'Reuniones y videollamadas',
      pt: 'Reuni\u00f5es e videochamadas',
      en: 'Meetings & video calls',
    },
    description: {
      es: 'Salas, grupos, invitaciones y resumen con IA despu\u00e9s de la reuni\u00f3n.',
      pt: 'Salas, grupos, convites e resumo com IA depois da reuni\u00e3o.',
      en: 'Rooms, breakouts, invites, and AI recap after the meeting.',
    },
    icon: Video,
    color: 'from-sky-500 to-cyan-700',
    borderColor: 'border-sky-200',
    bgHover: 'hover:border-sky-400 hover:shadow-sky-100',
    href: '/hub/meet',
    active: true,
    productTier: 'tool',
  },
];

const TOOLS_IDS = new Set(['advisor', 'studio', 'meet', 'carta', 'work']);

function isEtholysTool(sys: (typeof systems)[number]): boolean {
  return TOOLS_IDS.has(sys.id) || sys.productTier === 'advisor' || sys.productTier === 'tool';
}

function pickLocalized<T extends Record<Locale, string>>(row: T, locale: Locale): string {
  return row[locale] ?? row.es;
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
    // Platform / User.role ADMIN nunca deve ficar preso no shell de aluno FORGE
    if (u?.platformAdmin || u?.role === 'ADMIN') return;
    if (u?.forgeAccessMode === 'course_only') {
      const home = u.forgeHomePath;
      router.replace(home && home.startsWith('/') ? home : '/hub/forge/mis-cursos');
    }
  }, [status, session, router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-slate-50 px-4">
        <StateLoading className="h-full" />
      </div>
    );
  }

  const firstName = session?.user?.name?.split(' ')?.[0] || '';
  const toolCards = systems.filter(isEtholysTool);
  const systemCards = systems.filter((sys) => !isEtholysTool(sys));

  const renderHubCard = (sys: (typeof systems)[number]) => {
    const Icon = sys.icon;
    const isAdvisor = sys.productTier === 'advisor';
    const isTool = sys.productTier === 'tool';
    const cardAccess = resolveHubCardAccess(sys.id, sys.active, licensedSystems, {
      canManage,
      loading: accessLoading,
      companyLicensedSystems,
    });
    if (cardAccess === 'locked') {
      return (
        <div
          key={sys.id}
          className={`relative rounded-2xl border-2 border-dashed ${sys.borderColor} bg-white/80 p-6 opacity-75`}
        >
          <div className="mb-4 flex items-start justify-between">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${sys.color} opacity-50 shadow-sm`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              <Lock className="h-3 w-3" />
              {locale === 'es' ? 'Sin licencia' : locale === 'pt' ? 'Sem licença' : 'No license'}
            </div>
          </div>
          <h3 className="mb-1 text-xl font-bold text-slate-700">{sys.name}</h3>
          <p className="mb-3 text-sm font-medium text-slate-400">{pickLocalized(sys.tagline, locale)}</p>
          <p className="mb-4 text-sm leading-relaxed text-slate-400">
            {canManage
              ? locale === 'pt'
                ? 'Este sistema ainda não está no contrato da empresa. Contrate a licença para o activar.'
                : locale === 'es'
                  ? 'Este sistema aún no está en el contrato de la empresa. Contrate la licencia para activarlo.'
                  : 'This system is not on the company contract yet. Subscribe to activate it.'
              : locale === 'pt'
                ? 'O administrador da empresa ainda não lhe atribuiu este sistema.'
                : locale === 'es'
                  ? 'El administrador aún no le ha asignado este sistema.'
                  : 'Your company admin has not assigned this system to you yet.'}
          </p>
          <Link
            href={
              canManage
                ? `/hub/billing?sku=sys.${(sys.id || '').toUpperCase()}`
                : '/hub/admin'
            }
            className="text-sm font-medium text-teal-700 hover:underline"
          >
            {canManage
              ? locale === 'pt'
                ? 'Contratar licença'
                : locale === 'es'
                  ? 'Contratar licencia'
                  : 'Subscribe'
              : locale === 'pt'
                ? 'Pedir acesso'
                : locale === 'es'
                  ? 'Pedir acceso'
                  : 'Request access'}
          </Link>
        </div>
      );
    }
    if (cardAccess === 'open') {
      return (
        <Link
          key={sys.id}
          href={sys.href}
          className={`group relative bg-white rounded-2xl border-2 p-6 transition-all duration-200 hover:shadow-lg ${
            isAdvisor
              ? 'border-violet-300 ring-2 ring-violet-200/80 shadow-md shadow-violet-100/50 ' + sys.bgHover
              : isTool
                ? 'border-orange-300 ring-2 ring-orange-200/70 shadow-md shadow-orange-100/40 ' + sys.bgHover
                : `${sys.borderColor} ${sys.bgHover}`
          } `}
        >
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${sys.color} flex items-center justify-center shadow-sm`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            {isAdvisor ? (
              <div className="flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                Advisor
              </div>
            ) : isTool ? (
              <div className="flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-900">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                {locale === 'es' ? 'Herramienta' : locale === 'pt' ? 'Ferramenta' : 'Tool'}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                {locale === 'es' ? 'Activo' : locale === 'pt' ? 'Ativo' : 'Active'}
              </div>
            )}
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-1">{sys.name}</h3>
          <p className="text-sm font-medium text-slate-500 mb-3">{pickLocalized(sys.tagline, locale)}</p>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">{pickLocalized(sys.description, locale)}</p>
          <div
            className={`flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all ${
              isAdvisor ? 'text-violet-700' : isTool ? 'text-orange-700' : 'text-teal-600'
            }`}
          >
            {locale === 'es' ? 'Acceder' : locale === 'pt' ? 'Acessar' : 'Access'}
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      );
    }
    return (
      <div
        key={sys.id}
        className={`relative rounded-2xl border-2 bg-white/60 ${sys.borderColor} p-6 opacity-60`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${sys.color} flex items-center justify-center shadow-sm opacity-50`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
            <Lock className="w-3 h-3" />
            {locale === 'es' ? 'Pr\u00f3ximamente' : locale === 'pt' ? 'Em breve' : 'Coming soon'}
          </div>
        </div>
        <h3 className="text-xl font-bold text-slate-700 mb-1">{sys.name}</h3>
        <p className="text-sm font-medium text-slate-400 mb-3">{pickLocalized(sys.tagline, locale)}</p>
        <p className="text-sm text-slate-400 leading-relaxed">{pickLocalized(sys.description, locale)}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-800 text-lg">ETHOLYS</span>
              <span className="text-xs text-slate-400 ml-2 hidden sm:inline">Hub</span>
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
          <div className="flex items-center gap-2">
            <button onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-slate-100 transition text-slate-600">
              <Globe className="w-3.5 h-3.5" />{locale?.toUpperCase()}
            </button>
            {canManage && (
              <Link href="/hub/setup" className="px-3 py-1.5 text-xs rounded-lg hover:bg-slate-100 transition text-slate-600 hidden sm:inline-flex">
                {locale === 'es' ? 'Organización' : locale === 'pt' ? 'Organização' : 'Organization'}
              </Link>
            )}
            {canManage && (
              <Link href="/hub/billing" className="px-3 py-1.5 text-xs rounded-lg hover:bg-slate-100 transition text-slate-600 hidden sm:inline-flex">
                {locale === 'es' ? 'Licencias' : locale === 'pt' ? 'Licenças' : 'Billing'}
              </Link>
            )}
            <Link href="/hub/admin" className="px-3 py-1.5 text-xs rounded-lg hover:bg-slate-100 transition text-slate-600 hidden sm:inline-flex">
              {locale === 'es' ? 'Administración' : locale === 'pt' ? 'Administração' : 'Admin'}
            </Link>
            <Link href="https://etholys.com" className="px-3 py-1.5 text-xs rounded-lg hover:bg-slate-100 transition text-slate-600 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              {locale === 'es' ? 'Vitrina' : locale === 'pt' ? 'Vitrine' : 'Showcase'}
            </Link>
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
              <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">
                {firstName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span className="text-sm text-slate-700 hidden sm:inline">{firstName}</span>
              <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-slate-400 hover:text-red-500 transition" title={locale === 'es' ? 'Cerrar sesi\u00f3n' : locale === 'pt' ? 'Sair' : 'Sign out'}>
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {locale === 'es' ? `Hola, ${firstName}` : locale === 'pt' ? `Ol\u00e1, ${firstName}` : `Hello, ${firstName}`}
          </h1>
          <p className="text-slate-500 text-lg">
            {locale === 'es'
              ? 'Elija un sistema o una herramienta.'
              : locale === 'pt'
                ? 'Escolha um sistema ou uma ferramenta.'
                : 'Choose a system or a tool.'}
          </p>
          {canManage && setupNudge && (
            <p className="mt-2 text-sm text-slate-500">
              <Link href="/hub/setup" className="font-medium text-teal-700 hover:underline">
                {setupNudge === 'currency-mismatch'
                  ? locale === 'pt'
                    ? 'Atualizar perfil da organização'
                    : locale === 'es'
                      ? 'Actualizar perfil de la organización'
                      : 'Update organization profile'
                  : locale === 'pt'
                    ? 'Completar perfil da organização'
                    : locale === 'es'
                      ? 'Completar perfil de la organización'
                      : 'Complete organization profile'}
              </Link>
            </p>
          )}
        </div>

        {showLabShortcut && (
          <Link
            href="/lab"
            className="mb-8 flex items-start gap-4 rounded-2xl border-2 border-violet-300 bg-gradient-to-r from-slate-950 to-violet-950 p-5 shadow-md shadow-violet-200/40 transition hover:border-violet-400 hover:shadow-lg"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white">Etholys Lab</h2>
                <span className="rounded-full bg-violet-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                  {locale === 'pt' ? 'Interno' : locale === 'es' ? 'Interno' : 'Internal'}
                </span>
              </div>
              <p className="mt-1 text-sm text-violet-100/80">
                {locale === 'pt'
                  ? 'MUSE (inovação) e ANVIL (engenharia) — ferramentas internas da fábrica.'
                  : locale === 'es'
                    ? 'MUSE (innovación) y ANVIL (ingeniería) — herramientas internas de la fábrica.'
                    : 'MUSE (innovation) and ANVIL (engineering) — internal factory tools.'}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-violet-200">
                {locale === 'pt' ? 'Abrir Lab' : locale === 'es' ? 'Abrir Lab' : 'Open Lab'}{' '}
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        )}

        {showIntegratedWorkspace && (
        <Link
          href="/hub/workspace"
          className="mb-8 flex items-start gap-4 rounded-2xl border-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md"
        >
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white">
            <LayoutGrid className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900">
              {locale === 'pt' ? 'Centro integrado' : locale === 'es' ? 'Centro integrado' : 'Integrated workspace'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {locale === 'pt'
                ? 'Tarefas, resumo financeiro, projetos e atalhos num só lugar.'
                : locale === 'es'
                  ? 'Tareas, resumen financiero, proyectos y atajos en un solo lugar.'
                  : 'Tasks, financial snapshot, projects, and shortcuts in one place.'}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-teal-700">
              {locale === 'pt' ? 'Abrir' : locale === 'es' ? 'Abrir' : 'Open'} <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>
        )}

        {toolCards.length > 0 && (
          <section className="mb-10">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">Etholys Tools</h2>
              <p className="mt-1 text-sm text-slate-500">
                {locale === 'pt'
                  ? 'Ferramentas para o dia a dia da organização.'
                  : locale === 'es'
                    ? 'Herramientas para el día a día de la organización.'
                    : 'Everyday tools for your organization.'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {toolCards.map(renderHubCard)}
            </div>
          </section>
        )}

        {systemCards.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">
                {locale === 'pt' ? 'Sistemas' : locale === 'es' ? 'Sistemas' : 'Systems'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {locale === 'pt'
                  ? 'Os produtos da sua organização.'
                  : locale === 'es'
                    ? 'Los productos de su organización.'
                    : 'Your organization’s products.'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {systemCards.map(renderHubCard)}
            </div>
          </section>
        )}

        <div className="mt-10 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Layers className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1">ETHOLYS Core</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {locale === 'es'
                  ? 'Inicio de sesión, documentos, notificaciones y chat — compartidos por todos los sistemas.'
                  : locale === 'pt'
                    ? 'Sessão, documentos, notificações e chat — partilhados por todos os sistemas.'
                    : 'Sign-in, documents, notifications, and chat — shared across every system.'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
