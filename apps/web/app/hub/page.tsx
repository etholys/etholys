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
  LogOut, Globe, ArrowRight, Lock, ExternalLink, BrainCircuit,
} from 'lucide-react';
import {
  deriveModuleHints,
  isContextSetupMeaningful,
  type CompanyContextSetup,
  type ModuleHintCode,
} from '@/lib/company-context-setup';
import { isLikelyDbId } from '@/lib/utils';
import { StateLoading } from '@/components/ui/StateBlocks';
import { useLicensedSystems } from '@/hooks/useLicensedSystems';
import { resolveHubCardAccess } from '@/lib/hub-system-license';

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
  /** Cartão de produto reforçado (Advisor = transversal) */
  productTier?: 'advisor' | 'default';
}> = [
  {
    id: 'advisor',
    name: 'Etholys AI Advisor',
    tagline: {
      es: 'Asesor transversal e alertas',
      pt: 'Assessor transversal e alertas',
      en: 'Cross-system advisor & alerts',
    },
    description: {
      es: 'Lectura de datos de ATLAS, SIEP, FUNDHUB y m\u00e1s. Alertas, res\u00famenes y prioridades. El chat de trabajo (esquina inferior derecha) es otro producto: di\u00e1logo y canales.',
      pt: 'Leitura de dados de ATLAS, SIEP, FUNDHUB, etc. Alertas, resumos e prioridades. O chat de trabalho (canto inferior direito) \u00e9 outro: di\u00e1logo e canais.',
      en: 'Reads data across ATLAS, SIEP, FUNDHUB, and more. Alerts, digests, and priorities. The work chat (bottom right) is separate: dialogue and channels.',
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
    id: 'atlas',
    name: 'ATLAS',
    tagline: { es: 'ERP Integral', pt: 'ERP Integral', en: 'Comprehensive ERP' },
    description: {
      es: 'Gesti\u00f3n empresarial: finanzas, RRHH, inventario, facturaci\u00f3n y operaciones.',
      pt: 'Gest\u00e3o empresarial: finan\u00e7as, RH, estoque, fatura\u00e7\u00e3o e opera\u00e7\u00f5es.',
      en: 'Business management: finance, HR, inventory, invoicing, and operations.',
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
    tagline: { es: 'Gesti\u00f3n de Proyectos', pt: 'Gest\u00e3o de Projetos', en: 'Project Management' },
    description: {
      es: 'Portafolio de proyectos, ejecuci\u00f3n, stakeholders y marco l\u00f3gico.',
      pt: 'Portf\u00f3lio de projetos, execu\u00e7\u00e3o, stakeholders e marco l\u00f3gico.',
      en: 'Project portfolio, execution, stakeholders, and logical framework.',
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
    tagline: { es: 'Desarrollo de negocio', pt: 'Desenvolvimento de neg\u00f3cio', en: 'Business development' },
    description: {
      es: 'Red de contactos, asistencia comercial y copiloto para crecer con datos del ecosistema.',
      pt: 'Rede de contactos, assist\u00eancia comercial e copiloto para crescer com dados do ecossistema.',
      en: 'Contact network, commercial assistance, and copilot powered by ecosystem data.',
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
    tagline: { es: 'Educaci\u00f3n y juegos', pt: 'Educa\u00e7\u00e3o e jogos', en: 'Education & games' },
    description: {
      es: 'Formaci\u00f3n, tableros did\u00e1cticos y aprendizaje tradicional con enfoque territorial.',
      pt: 'Forma\u00e7\u00e3o, jogos de tabuleiro e aprendizagem tradicional com foco territorial.',
      en: 'Training, board games, and traditional learning with a territorial focus.',
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
    tagline: { es: 'ESG y est\u00e1ndares', pt: 'ESG e padr\u00f5es', en: 'ESG & standards' },
    description: {
      es: 'Datos ESG, marcos de referencia y lectura para financiadores \u2014 no duplica el M&E del SIEP.',
      pt: 'Dados ESG, referenciais e leitura para financiadores \u2014 n\u00e3o duplica o M&E do SIEP.',
      en: 'ESG data, frameworks, and funder-ready views \u2014 not a duplicate of SIEP M&E.',
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
      es: 'Capa transversal: trazabilidad m\u00ednima de aprobaciones (v0) \u2014 pr\u00f3ximas iteraciones multi-m\u00f3dulo.',
      pt: 'Camada transversal: rasto m\u00ednimo de aprova\u00e7\u00f5es (v0) \u2014 itera\u00e7\u00f5es multi-m\u00f3dulo a seguir.',
      en: 'Cross-cutting layer: minimal approval trail (v0) \u2014 multi-module flows in later iterations.',
    },
    icon: Scale,
    color: 'from-slate-600 to-slate-800',
    borderColor: 'border-slate-300',
    bgHover: 'hover:border-slate-500 hover:shadow-slate-100/80',
    href: '/hub/carta',
    active: true,
  },
];

function pickLocalized<T extends Record<Locale, string>>(row: T, locale: Locale): string {
  return row[locale] ?? row.es;
}

export default function HubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale, setLocale, activeCompanyId } = useApp();
  const { licensedSystems, showIntegratedWorkspace } = useLicensedSystems(activeCompanyId);
  const [moduleHints, setModuleHints] = useState<ModuleHintCode[]>([]);
  const [hasMeaningfulSetup, setHasMeaningfulSetup] = useState(false);
  const [setupNudge, setSetupNudge] = useState<null | 'missing' | 'currency-mismatch'>(null);

  const companyId = activeCompanyId && isLikelyDbId(activeCompanyId) ? activeCompanyId : '';

  useEffect(() => {
    let cancelled = false;
    async function loadContextFlags() {
      if (!companyId) {
        if (!cancelled) {
          setModuleHints([]);
          setHasMeaningfulSetup(false);
          setSetupNudge(null);
        }
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
          if (!cancelled) {
            setModuleHints([]);
            setHasMeaningfulSetup(false);
            setSetupNudge('missing');
          }
          return;
        }

        const ctx = raw as CompanyContextSetup;
        const meaningful = isContextSetupMeaningful(ctx);
        const hints = deriveModuleHints(ctx);
        const currencyOp = String(ctx.currencyOp || '').trim().toUpperCase();
        const companyCurrency = String(d.company?.currency || '').trim().toUpperCase();

        let nudge: null | 'missing' | 'currency-mismatch' = null;
        if (!d.company?.contextSetupAt || !meaningful) {
          nudge = 'missing';
        } else if (currencyOp && companyCurrency && currencyOp !== companyCurrency) {
          nudge = 'currency-mismatch';
        }

        if (!cancelled) {
          setHasMeaningfulSetup(meaningful);
          setModuleHints(hints);
          setSetupNudge(nudge);
        }
      } catch {
        // Do not block Hub if setup endpoint is temporarily unavailable.
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

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-slate-50 px-4">
        <StateLoading className="h-full" />
      </div>
    );
  }

  const firstName = session?.user?.name?.split(' ')?.[0] || '';
  const hintSet = new Set(moduleHints);
  const visibleSystems = systems.filter((sys) => {
    if (sys.id === 'advisor') return true;
    if (!hasMeaningfulSetup || moduleHints.length === 0) return true;
    const code = sys.id.toUpperCase() as ModuleHintCode;
    return hintSet.has(code);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-lg">ETHOLYS</span>
              <span className="text-xs text-slate-400 ml-2 hidden sm:inline">Hub</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLocale(locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es')} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-slate-100 transition text-slate-600">
              <Globe className="w-3.5 h-3.5" />{locale?.toUpperCase()}
            </button>
            <Link href="/hub/admin" className="px-3 py-1.5 text-xs rounded-lg hover:bg-slate-100 transition text-slate-600 hidden sm:inline-flex">
              {locale === 'es' ? 'Administración' : locale === 'pt' ? 'Administração' : 'Admin'}
            </Link>
            <Link href="/" className="px-3 py-1.5 text-xs rounded-lg hover:bg-slate-100 transition text-slate-600 flex items-center gap-1">
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
              ? 'Selecciona un sistema para comenzar a trabajar.'
              : locale === 'pt' ? 'Selecione um sistema para come\u00e7ar a trabalhar.'
              : 'Select a system to start working.'}
          </p>
        </div>

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
                ? 'Uma única vista para tarefas, resumo financeiro, projetos e atalhos — o administrador escolhe quem tem acesso. Não duplica o ATLAS: alterações refletem nos sistemas.'
                : locale === 'es'
                  ? 'Una sola vista para tareas, resumen, proyectos y atajos. El admin elige quién accede. Los cambios se reflejan en cada sistema.'
                  : 'One place for tasks, financial snapshot, projects, and deep links. Your admin controls access. Changes stay in each system.'}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-teal-700">
              {locale === 'pt' ? 'Abrir' : locale === 'es' ? 'Abrir' : 'Open'} <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>
        )}

        <div className="mb-8 text-center">
          <Link
            href="/hub/setup"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-teal-700"
          >
            {locale === 'pt'
              ? 'Assistente de contexto da organização (sector, comércio, prioridades)'
              : locale === 'es'
                ? 'Asistente de contexto de la organización (sector, comercio, prioridades)'
                : 'Organization context setup (sector, trade, priorities)'}
          </Link>
          {hasMeaningfulSetup && moduleHints.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {locale === 'pt'
                ? `Módulos filtrados por contexto (${moduleHints.join(', ')}). Reabra o assistente para ajustar.`
                : locale === 'es'
                  ? `Módulos filtrados por contexto (${moduleHints.join(', ')}). Reabra el asistente para ajustar.`
                  : `Modules filtered by org context (${moduleHints.join(', ')}). Re-open setup to adjust.`}
            </p>
          )}
          {licensedSystems && licensedSystems.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {locale === 'pt'
                ? `Sistemas licenciados para si: ${licensedSystems.join(', ')}. Sem acesso? Peça ao administrador em /hub/admin.`
                : locale === 'es'
                  ? `Sistemas con licencia para usted: ${licensedSystems.join(', ')}. ¿Sin acceso? Pida al administrador en /hub/admin.`
                  : `Licensed systems for you: ${licensedSystems.join(', ')}. No access? Ask your admin at /hub/admin.`}
            </p>
          )}
          {setupNudge && (
            <div className="mx-auto mt-3 max-w-2xl rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-left text-xs text-amber-900">
              <p className="font-semibold">
                {locale === 'pt'
                  ? 'Revisar contexto da organização recomendado'
                  : locale === 'es'
                    ? 'Se recomienda revisar el contexto de la organización'
                    : 'Organization context review recommended'}
              </p>
              <p className="mt-0.5">
                {setupNudge === 'currency-mismatch'
                  ? locale === 'pt'
                    ? 'A moeda operacional no setup difere da moeda atual da empresa. Atualize o assistente para evitar sugestões inconsistentes.'
                    : locale === 'es'
                      ? 'La moneda operativa del setup difiere de la moneda actual de la empresa. Actualice el asistente para evitar sugerencias inconsistentes.'
                      : 'Setup operating currency differs from current company currency. Re-run setup to avoid inconsistent guidance.'
                  : locale === 'pt'
                    ? 'Ainda não há contexto suficiente (ou atualizado) para personalizar módulos e sugestões.'
                    : locale === 'es'
                      ? 'Aún no hay contexto suficiente (o actualizado) para personalizar módulos y sugerencias.'
                      : 'There is not enough (or updated) context yet to personalize modules and guidance.'}
              </p>
              <div className="mt-1.5">
                <Link href="/hub/setup" className="font-semibold text-amber-900 underline decoration-amber-400 hover:decoration-amber-700">
                  {locale === 'pt' ? 'Abrir assistente agora' : locale === 'es' ? 'Abrir asistente ahora' : 'Open setup now'}
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* System Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleSystems.map((sys) => {
            const Icon = sys.icon;
            const isAdvisor = sys.productTier === 'advisor';
            const cardAccess = resolveHubCardAccess(sys.id, sys.active, licensedSystems);
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
                    {locale === 'pt'
                      ? 'O administrador da empresa ainda não lhe atribuiu este sistema.'
                      : locale === 'es'
                        ? 'El administrador aún no le ha asignado este sistema.'
                        : 'Your company admin has not assigned this system to you yet.'}
                  </p>
                  <Link href="/hub/admin" className="text-sm font-medium text-teal-700 hover:underline">
                    {locale === 'pt' ? 'Administração Etholys' : locale === 'es' ? 'Administración Etholys' : 'Etholys administration'}
                  </Link>
                </div>
              );
            }
            return cardAccess === 'open' ? (
              <Link
                key={sys.id}
                href={sys.href}
                className={`group relative bg-white rounded-2xl border-2 p-6 transition-all duration-200 hover:shadow-lg ${
                  isAdvisor
                    ? 'border-violet-300 ring-2 ring-violet-200/80 shadow-md shadow-violet-100/50 ' + sys.bgHover
                    : `${sys.borderColor} ${sys.bgHover}`
                } `}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${sys.color} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  {isAdvisor ? (
                    <div className="flex max-w-[10rem] flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                        {locale === 'es' ? 'Transversal' : locale === 'pt' ? 'Transversal' : 'Transversal'}
                      </div>
                      <span className="text-right text-[10px] text-violet-600/90">
                        {locale === 'es' ? 'También: botón flotante' : locale === 'pt' ? 'Também: botão flutuante' : 'Also: floating button'}
                      </span>
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
                    isAdvisor ? 'text-violet-700' : 'text-teal-600'
                  }`}
                >
                  {locale === 'es' ? 'Acceder' : locale === 'pt' ? 'Acessar' : 'Access'}
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            ) : (
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
          })}
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          {locale === 'pt' ? (
            <>
              <strong className="text-violet-800">Dica:</strong> em qualquer ecrã autenticado, o{' '}
              <strong>botão roxo</strong> (canto inferior esquerdo) abre o mesmo assessor: alertas rápidos. O <strong>chat teal</strong>{' '}
              (canto direito) é diálogo e canais de trabalho — outro propósito.
            </>
          ) : locale === 'es' ? (
            <>
              <strong className="text-violet-800">Tip:</strong> en cualquier pantalla, el <strong>botón morado</strong> (abajo a la
              izquierda) = Advisor. El <strong>chat teal</strong> (derecha) = diálogo y equipos.
            </>
          ) : (
            <>
              <strong className="text-violet-800">Tip:</strong> on any screen, the <strong>purple button</strong> (bottom left) = Advisor
              digests. The <strong>teal chat</strong> (right) = work dialogue — different purpose.
            </>
          )}
        </p>

        {/* ETHOLYS Core banner */}
        <div className="mt-10 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Layers className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1">ETHOLYS Core</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {locale === 'es'
                  ? 'Capa transversal del ecosistema: SSO, gesti\u00f3n documental, notificaciones, permisos, i18n, chat interno y m\u00e1s. Todos los sistemas comparten esta base com\u00fan.'
                  : locale === 'pt' ? 'Camada transversal do ecossistema: SSO, gest\u00e3o documental, notifica\u00e7\u00f5es, permiss\u00f5es, i18n, chat interno e mais. Todos os sistemas compartilham esta base comum.'
                  : 'Cross-cutting ecosystem layer: SSO, document management, notifications, permissions, i18n, internal chat, and more. All systems share this common base.'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
