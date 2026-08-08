'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import type { Locale } from '@/lib/i18n';

const SYSTEMS: Array<{
  id: string;
  name: string;
  accent: string;
  tagline: Record<Locale, string>;
}> = [
  {
    id: 'atlas',
    name: 'ATLAS',
    accent: '#0D9488',
    tagline: {
      es: 'ERP 360° — finanzas, RRHH, inventario y operaciones',
      pt: 'ERP 360° — finanças, RH, inventário e operações',
      en: 'ERP 360° — finance, HR, inventory and operations',
    },
  },
  {
    id: 'siep',
    name: 'SIEP',
    accent: '#4F46E5',
    tagline: {
      es: 'Ejecución e innovación de proyectos',
      pt: 'Execução e inovação de projetos',
      en: 'Project execution and innovation',
    },
  },
  {
    id: 'fundhub',
    name: 'FUNDHUB',
    accent: '#D97706',
    tagline: {
      es: 'Captación inteligente de recursos',
      pt: 'Captação inteligente de recursos',
      en: 'Intelligent fundraising',
    },
  },
  {
    id: 'nexus',
    name: 'NEXUS',
    accent: '#2563EB',
    tagline: {
      es: 'Desarrollo MIPYME con IA',
      pt: 'Desenvolvimento MIPYME com IA',
      en: 'MSME development with AI',
    },
  },
  {
    id: 'forge',
    name: 'FORGE',
    accent: '#7C3AED',
    tagline: {
      es: 'Aprendizaje, juegos y conexiones',
      pt: 'Aprendizagem, jogos e conexões',
      en: 'Learning, games and connections',
    },
  },
  {
    id: 'prism',
    name: 'PRISM',
    accent: '#E11D48',
    tagline: {
      es: 'Inteligencia ejecutiva y BI',
      pt: 'Inteligência executiva e BI',
      en: 'Executive intelligence and BI',
    },
  },
];

const TOOLS: Array<{ name: string; blurb: Record<Locale, string> }> = [
  {
    name: 'Advisor',
    blurb: {
      es: 'Alertas y prioridades transversales',
      pt: 'Alertas e prioridades transversais',
      en: 'Cross-system alerts and priorities',
    },
  },
  {
    name: 'Studio',
    blurb: {
      es: 'Documentos con IA',
      pt: 'Documentos com IA',
      en: 'AI-assisted documents',
    },
  },
  {
    name: 'Meet',
    blurb: {
      es: 'Reuniones y videollamadas',
      pt: 'Reuniões e videochamadas',
      en: 'Meetings and video calls',
    },
  },
  {
    name: 'CARTA',
    blurb: {
      es: 'Gobernanza y aprobaciones',
      pt: 'Governança e aprovações',
      en: 'Governance and approvals',
    },
  },
];

function copy(locale: Locale) {
  const es = locale === 'es';
  const pt = locale === 'pt';
  return {
    navEcosystem: es ? 'Ecosistema' : pt ? 'Ecossistema' : 'Ecosystem',
    navSystems: es ? 'Sistemas' : pt ? 'Sistemas' : 'Systems',
    navTools: 'Tools',
    navHow: es ? 'Cómo funciona' : pt ? 'Como funciona' : 'How it works',
    enter: es ? 'Entrar' : pt ? 'Entrar' : 'Sign in',
    demo: es ? 'Solicitar demostración' : pt ? 'Solicitar demonstração' : 'Request a demo',
    headline: es
      ? 'Un ecosistema para gestionar, financiar, ejecutar, aprender y decidir mejor.'
      : pt
        ? 'Um ecossistema para gerir, financiar, executar, aprender e decidir melhor.'
        : 'An ecosystem to manage, fund, execute, learn and decide better.',
    support: es
      ? 'Seis sistemas independientes, herramientas transversales y una sola capa de acceso. Active solo lo que su organización necesita.'
      : pt
        ? 'Seis sistemas independentes, ferramentas transversais e uma única camada de acesso. Ative apenas o que a sua organização precisa.'
        : 'Six independent systems, cross-cutting tools, and one access layer. Activate only what your organization needs.',
    ctaPrimary: es ? 'Conocer el ecosistema' : pt ? 'Conhecer o ecossistema' : 'Explore the ecosystem',
    ctaSecondary: es ? 'Ver los 6 sistemas' : pt ? 'Ver os 6 sistemas' : 'See the 6 systems',
    systemsKicker: es ? 'Productos licenciables' : pt ? 'Produtos licenciáveis' : 'Licensable products',
    systemsTitle: es
      ? 'Productos distintos. Una experiencia coherente.'
      : pt
        ? 'Produtos distintos. Uma experiência coerente.'
        : 'Distinct products. One coherent experience.',
    systemsLead: es
      ? 'Cada sistema se vende y funciona por separado. Cuando combina varios, los datos se cruzan sin duplicar información.'
      : pt
        ? 'Cada sistema vende-se e funciona em separado. Quando combina vários, os dados cruzam-se sem duplicar informação.'
        : 'Each system sells and runs on its own. Combine several and data connects without duplication.',
    howKicker: es ? 'Modelo' : pt ? 'Modelo' : 'Model',
    howTitle: es
      ? 'Modular por diseño. Integrado por naturaleza.'
      : pt
        ? 'Modular por design. Integrado por natureza.'
        : 'Modular by design. Integrated by nature.',
    howSteps: es
      ? [
          ['Elija', 'Contrate solo los sistemas que necesita hoy.'],
          ['Active', 'Un solo acceso (SSO) a todo el ecosistema contratado.'],
          ['Conecte', 'Puentes contextuales entre finanzas, proyectos, fondos y BI.'],
        ]
      : pt
        ? [
            ['Escolha', 'Contrate apenas os sistemas de que precisa hoje.'],
            ['Ative', 'Um único acesso (SSO) a todo o ecossistema contratado.'],
            ['Ligue', 'Pontes contextuais entre finanças, projetos, fundos e BI.'],
          ]
        : [
            ['Choose', 'License only the systems you need today.'],
            ['Activate', 'One SSO into your contracted ecosystem.'],
            ['Connect', 'Contextual bridges across finance, projects, funds and BI.'],
          ],
    toolsKicker: 'Etholys Tools',
    toolsTitle: es
      ? 'Herramientas transversales en todos los sistemas'
      : pt
        ? 'Ferramentas transversais em todos os sistemas'
        : 'Cross-cutting tools across every system',
    coreTitle: 'ETHOLYS Core',
    coreBody: es
      ? 'SSO, documentos, notificaciones, permisos, i18n y chat — la base común incluida en cada contratación.'
      : pt
        ? 'SSO, documentos, notificações, permissões, i18n e chat — a base comum incluída em cada contratação.'
        : 'SSO, documents, notifications, permissions, i18n and chat — the shared base in every license.',
    contactKicker: es ? 'Siguiente paso' : pt ? 'Próximo passo' : 'Next step',
    contactTitle: es
      ? 'Hablemos de su organización.'
      : pt
        ? 'Falemos da sua organização.'
        : 'Let’s talk about your organization.',
    contactBody: es
      ? 'La plataforma está en fase privada. Solicite una demostración o use el enlace de su invitación.'
      : pt
        ? 'A plataforma está em fase privada. Solicite uma demonstração ou use o link do seu convite.'
        : 'The platform is in a private phase. Request a demo or use your invitation link.',
    factory: es ? 'Fábrica de Soluciones' : pt ? 'Fábrica de Soluções' : 'Solutions Factory',
    rights: '© Etholys',
  };
}

export default function InstitutionalHome() {
  const { locale, setLocale } = useApp();
  const t = copy(locale);
  const nextLocale: Locale = locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es';
  const [loginHref, setLoginHref] = useState('/login');

  useEffect(() => {
    const host = window.location.hostname;
    if (host === 'etholys.com' || host === 'www.etholys.com') {
      setLoginHref('https://app.etholys.com/login');
    }
  }, []);

  return (
    <div className="etholys-site min-h-screen bg-[#07111A] text-[#E8EEF2]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-teal-500 focus:px-3 focus:py-2 focus:text-slate-950"
      >
        Skip
      </a>

      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="#inicio" className="font-[family-name:var(--font-etholys-display)] text-xl font-bold tracking-[0.18em] text-white">
            ETHOLYS
          </a>
          <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex" aria-label="Primary">
            <a href="#ecosistema" className="transition hover:text-white">
              {t.navEcosystem}
            </a>
            <a href="#sistemas" className="transition hover:text-white">
              {t.navSystems}
            </a>
            <a href="#tools" className="transition hover:text-white">
              {t.navTools}
            </a>
            <a href="#modelo" className="transition hover:text-white">
              {t.navHow}
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setLocale(nextLocale)}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium uppercase tracking-wider text-white/60 transition hover:bg-white/5 hover:text-white"
              aria-label="Change language"
            >
              {nextLocale}
            </button>
            <Link
              href={loginHref}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-white/80 transition hover:text-white"
            >
              {t.enter}
            </Link>
            <a
              href="mailto:hola@etholys.com?subject=Demostraci%C3%B3n%20Etholys"
              className="hidden rounded-md bg-teal-500 px-3.5 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 sm:inline-flex"
            >
              {t.demo}
            </a>
          </div>
        </div>
      </header>

      {/* Hero — full-bleed atmosphere */}
      <section id="inicio" className="relative isolate min-h-[100svh] overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_20%,rgba(13,148,136,0.28),transparent_55%),radial-gradient(90%_70%_at_10%_90%,rgba(15,23,42,0.9),transparent_50%),linear-gradient(165deg,#041018_0%,#0B1C24_42%,#07111A_100%)]"
        />
        <div
          aria-hidden
          className="etholys-site-grid absolute inset-0 opacity-[0.18]"
        />
        <div
          aria-hidden
          className="etholys-site-orbit absolute -right-[18%] top-[8%] h-[70vmin] w-[70vmin] rounded-full border border-teal-400/20"
        />
        <div
          aria-hidden
          className="etholys-site-orbit-slow absolute -right-[8%] top-[22%] h-[48vmin] w-[48vmin] rounded-full border border-teal-300/10"
        />
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] opacity-40 lg:block"
          viewBox="0 0 800 900"
          fill="none"
        >
          <g stroke="rgba(94,234,212,0.35)" strokeWidth="1.2">
            <rect x="120" y="180" width="220" height="140" rx="18" />
            <rect x="390" y="160" width="220" height="140" rx="18" />
            <rect x="250" y="380" width="220" height="140" rx="18" />
            <rect x="120" y="600" width="220" height="140" rx="18" />
            <rect x="390" y="580" width="220" height="140" rx="18" />
            <path d="M230 320v60M500 300v80M360 520v60M230 740v0" strokeOpacity="0.5" />
            <path d="M340 250h50M280 450h70M340 670h50" strokeOpacity="0.45" />
          </g>
          <g fill="rgba(45,212,191,0.12)">
            <rect x="120" y="180" width="220" height="140" rx="18" />
            <rect x="390" y="160" width="220" height="140" rx="18" />
            <rect x="250" y="380" width="220" height="140" rx="18" />
          </g>
        </svg>

        <div
          id="contenido"
          className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-16 pt-28 sm:px-8 sm:pb-24 lg:justify-center lg:pb-20"
        >
          <div className="etholys-site-rise max-w-2xl">
            <p className="font-[family-name:var(--font-etholys-display)] text-5xl font-bold tracking-[0.14em] text-white sm:text-6xl md:text-7xl">
              ETHOLYS
            </p>
            <h1 className="mt-6 max-w-xl font-[family-name:var(--font-etholys-display)] text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
              {t.headline}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/65 sm:text-lg">
              {t.support}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#ecosistema"
                className="inline-flex items-center rounded-md bg-teal-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
              >
                {t.ctaPrimary}
              </a>
              <a
                href="#sistemas"
                className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
              >
                {t.ctaSecondary}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem map */}
      <section id="ecosistema" className="relative border-t border-white/10 bg-[#08131C] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-400/90">
            {t.navEcosystem}
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-etholys-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.systemsTitle}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">{t.systemsLead}</p>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEMS.map((sys) => (
              <a
                key={sys.id}
                href={`#${sys.id}`}
                className="group block border border-white/10 bg-[#0C1822] p-5 transition hover:border-teal-400/40 hover:bg-[#0F1F2B]"
              >
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: sys.accent }} />
                  <span className="font-[family-name:var(--font-etholys-display)] text-lg font-semibold tracking-wide text-white">
                    {sys.name}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/55 group-hover:text-white/75">
                  {sys.tagline[locale]}
                </p>
              </a>
            ))}
          </div>

          <div className="mt-3 border border-teal-500/30 bg-teal-500/10 px-5 py-4 text-center text-sm font-medium tracking-wide text-teal-100">
            {t.coreTitle} — {t.coreBody}
          </div>
        </div>
      </section>

      {/* Systems detail */}
      <section id="sistemas" className="border-t border-white/10 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-400/90">
            {t.systemsKicker}
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-etholys-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.navSystems}
          </h2>
          <div className="mt-12 divide-y divide-white/10 border-y border-white/10">
            {SYSTEMS.map((sys, index) => (
              <div
                key={sys.id}
                id={sys.id}
                className="etholys-site-row grid gap-4 py-8 sm:grid-cols-[7rem_1fr] sm:items-baseline"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <span
                  className="font-[family-name:var(--font-etholys-display)] text-sm font-bold tracking-[0.16em]"
                  style={{ color: sys.accent }}
                >
                  {sys.name}
                </span>
                <p className="text-lg text-white/75 sm:text-xl">{sys.tagline[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="modelo" className="border-t border-white/10 bg-[#08131C] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-400/90">{t.howKicker}</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-etholys-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.howTitle}
          </h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {t.howSteps.map(([title, body], i) => (
              <li key={title} className="relative">
                <span className="font-[family-name:var(--font-etholys-display)] text-5xl font-bold text-white/10">
                  0{i + 1}
                </span>
                <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Tools */}
      <section id="tools" className="border-t border-white/10 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-400/90">{t.toolsKicker}</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-etholys-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.toolsTitle}
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map((tool) => (
              <div key={tool.name} className="bg-[#07111A] p-6">
                <h3 className="font-[family-name:var(--font-etholys-display)] text-lg font-semibold text-white">
                  {tool.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{tool.blurb[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section id="contacto" className="border-t border-white/10 bg-[#041018] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-400/90">
            {t.contactKicker}
          </p>
          <h2 className="mt-3 max-w-xl font-[family-name:var(--font-etholys-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.contactTitle}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/60">{t.contactBody}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="mailto:hola@etholys.com?subject=Demostraci%C3%B3n%20Etholys"
              className="inline-flex rounded-md bg-teal-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
            >
              {t.demo}
            </a>
            <Link
              href={loginHref}
              className="inline-flex rounded-md border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/40"
            >
              {t.enter}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 text-sm text-white/40 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <span className="font-[family-name:var(--font-etholys-display)] tracking-[0.16em] text-white/70">
              ETHOLYS
            </span>
            <span className="ml-3">{t.factory}</span>
          </div>
          <p>
            {t.rights} {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
