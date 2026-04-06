'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useApp } from '@/app/providers';
import Link from 'next/link';
import {
  Layers, BarChart3, Sprout, HandCoins, GraduationCap, Cpu, Target,
  LogOut, Globe, ArrowRight, Lock, ExternalLink
} from 'lucide-react';

const systems = [
  {
    id: 'atlas',
    name: 'ATLAS',
    tagline: { es: 'ERP Integral', pt: 'ERP Integral', en: 'Comprehensive ERP' },
    description: {
      es: 'Gesti\u00f3n integral de proyectos, finanzas, RRHH, inventario, facturaci\u00f3n y m\u00e1s.',
      pt: 'Gest\u00e3o integral de projetos, finan\u00e7as, RH, estoque, fatura\u00e7\u00e3o e mais.',
      en: 'Comprehensive management of projects, finances, HR, inventory, invoicing, and more.',
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
    tagline: { es: 'Cooperaci\u00f3n y Fondos', pt: 'Coopera\u00e7\u00e3o e Fundos', en: 'Cooperation & Funds' },
    description: {
      es: 'Gesti\u00f3n de cooperaci\u00f3n internacional, fondos y alianzas estrat\u00e9gicas.',
      pt: 'Gest\u00e3o de coopera\u00e7\u00e3o internacional, fundos e alian\u00e7as estrat\u00e9gicas.',
      en: 'Management of international cooperation, funds, and strategic alliances.',
    },
    icon: HandCoins,
    color: 'from-amber-500 to-orange-600',
    borderColor: 'border-gray-200',
    bgHover: 'hover:border-amber-300',
    href: '#',
    active: false,
  },
  {
    id: 'nexus',
    name: 'NEXUS',
    tagline: { es: 'Educaci\u00f3n y Capacitaci\u00f3n', pt: 'Educa\u00e7\u00e3o e Capacita\u00e7\u00e3o', en: 'Education & Training' },
    description: {
      es: 'Plataforma de formaci\u00f3n, capacitaci\u00f3n y gesti\u00f3n del conocimiento.',
      pt: 'Plataforma de forma\u00e7\u00e3o, capacita\u00e7\u00e3o e gest\u00e3o do conhecimento.',
      en: 'Training, capacity building, and knowledge management platform.',
    },
    icon: GraduationCap,
    color: 'from-blue-500 to-indigo-600',
    borderColor: 'border-gray-200',
    bgHover: 'hover:border-blue-300',
    href: '#',
    active: false,
  },
  {
    id: 'forge',
    name: 'FORGE',
    tagline: { es: 'Innovaci\u00f3n y Hardware', pt: 'Inova\u00e7\u00e3o e Hardware', en: 'Innovation & Hardware' },
    description: {
      es: 'Dise\u00f1o, prototipado e innovaci\u00f3n tecnol\u00f3gica con enfoque territorial.',
      pt: 'Design, prototipagem e inova\u00e7\u00e3o tecnol\u00f3gica com foco territorial.',
      en: 'Design, prototyping, and technological innovation with territorial focus.',
    },
    icon: Cpu,
    color: 'from-violet-500 to-purple-600',
    borderColor: 'border-gray-200',
    bgHover: 'hover:border-violet-300',
    href: '#',
    active: false,
  },
  {
    id: 'prism',
    name: 'PRISM',
    tagline: { es: 'Monitoreo y Evaluaci\u00f3n', pt: 'Monitoramento e Avalia\u00e7\u00e3o', en: 'Monitoring & Evaluation' },
    description: {
      es: 'Monitoreo, evaluaci\u00f3n de impacto e indicadores estrat\u00e9gicos.',
      pt: 'Monitoramento, avalia\u00e7\u00e3o de impacto e indicadores estrat\u00e9gicos.',
      en: 'Monitoring, impact evaluation, and strategic indicators.',
    },
    icon: Target,
    color: 'from-rose-500 to-pink-600',
    borderColor: 'border-gray-200',
    bgHover: 'hover:border-rose-300',
    href: '#',
    active: false,
  },
];

export default function HubPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const { locale, setLocale } = useApp();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = session?.user?.name?.split(' ')?.[0] || '';

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

        {/* System Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {systems.map((sys) => {
            const Icon = sys.icon;
            return sys.active ? (
              <Link
                key={sys.id}
                href={sys.href}
                className={`group relative bg-white rounded-2xl border-2 ${sys.borderColor} ${sys.bgHover} p-6 transition-all duration-200 hover:shadow-lg`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${sys.color} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                    {locale === 'es' ? 'Activo' : locale === 'pt' ? 'Ativo' : 'Active'}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">{sys.name}</h3>
                <p className="text-sm font-medium text-slate-500 mb-3">{sys.tagline[locale]}</p>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">{sys.description[locale]}</p>
                <div className="flex items-center gap-1 text-teal-600 text-sm font-medium group-hover:gap-2 transition-all">
                  {locale === 'es' ? 'Acceder' : locale === 'pt' ? 'Acessar' : 'Access'}
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            ) : (
              <div
                key={sys.id}
                className={`relative bg-white/60 rounded-2xl border-2 ${sys.borderColor} p-6 opacity-60`}
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
                <p className="text-sm font-medium text-slate-400 mb-3">{sys.tagline[locale]}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{sys.description[locale]}</p>
              </div>
            );
          })}
        </div>



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
