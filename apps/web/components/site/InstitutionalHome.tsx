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
      es: 'Gestión empresarial: planificación, finanzas, contabilidad, RR. HH., proveedores, clientes e inventario.',
      pt: 'Gestão empresarial: planeamento, finanças, contabilidade, RH, fornecedores, clientes e inventário.',
      en: 'Business management: planning, finance, accounting, HR, suppliers, clients and inventory.',
    },
  },
  {
    id: 'siep',
    name: 'SIEP',
    accent: '#4F46E5',
    tagline: {
      es: 'Gestión de proyectos: portafolio, ejecución, evidencias e informes.',
      pt: 'Gestão de projetos: portefólio, execução, evidências e relatórios.',
      en: 'Project management: portfolio, execution, evidence and reporting.',
    },
  },
  {
    id: 'fundhub',
    name: 'FUNDHUB',
    accent: '#D97706',
    tagline: {
      es: 'Captación de fondos: convocatorias, redacción de propuestas y seguimiento.',
      pt: 'Captação de fundos: editais, redação de propostas e acompanhamento.',
      en: 'Fundraising: calls, proposal writing and follow-up.',
    },
  },
  {
    id: 'nexus',
    name: 'NEXUS',
    accent: '#2563EB',
    tagline: {
      es: 'Asistencia técnica para el desarrollo de negocios en distintas etapas de madurez.',
      pt: 'Assistência técnica para o desenvolvimento de negócios em distintas etapas de maturidade.',
      en: 'Technical assistance for business development across maturity stages.',
    },
  },
  {
    id: 'forge',
    name: 'FORGE',
    accent: '#7C3AED',
    tagline: {
      es: 'Cursos virtuales con metodologías tradicionales o lúdicas — creación y alojamiento.',
      pt: 'Cursos virtuais com metodologias tradicionais ou lúdicas — criação e alojamento.',
      en: 'Virtual courses with traditional or game-based methods — create and host.',
    },
  },
];

function copy(locale: Locale) {
  const es = locale === 'es';
  const pt = locale === 'pt';
  return {
    navAbout: es ? 'Quiénes somos' : pt ? 'Quem somos' : 'About',
    navServices: es ? 'Servicios' : pt ? 'Serviços' : 'Services',
    navSystems: es ? 'Sistemas' : pt ? 'Sistemas' : 'Systems',
    enter: es ? 'Entrar' : pt ? 'Entrar' : 'Sign in',
    demo: es ? 'Solicitar demostración' : pt ? 'Solicitar demonstração' : 'Request a demo',

    headline: es
      ? 'Usted atiende empresas o ejecuta proyectos. Etholys es el sistema para ese trabajo.'
      : pt
        ? 'Você atende empresas ou executa projectos. A Etholys é o sistema para esse trabalho.'
        : 'You support businesses or run projects. Etholys is the system for that work.',
    support: es
      ? 'Seguimiento a cada empresa, ejecución y reportes, búsqueda de fondos, formación. Lo usan MIPYMEs, fundaciones, agencias, gobiernos y empresas. En español y portugués.'
      : pt
        ? 'Acompanhamento de cada empresa, execução e relatórios, procura de fundos, formação. Usam MIPYMEs, fundações, agências, governos e empresas. Em espanhol e português.'
        : 'Follow each business, deliver and report, find funding, train people. Used by MSMEs, foundations, agencies, governments and companies. In Spanish and Portuguese.',

    aboutKicker: es ? 'Quiénes somos' : pt ? 'Quem somos' : 'About',
    aboutTitle: es ? 'Qué es Etholys' : pt ? 'O que é a Etholys' : 'What Etholys is',
    aboutBody: es
      ? 'Si su organización trabaja con MIPYMEs, con proyectos financiados, o con las dos cosas, aquí hace ese trabajo: diagnóstico y visitas, el proyecto y el informe al donante, las convocatorias, los cursos. Cada módulo se contrata por separado. En español y portugués. En nuestros servidores o en los de ustedes.'
      : pt
        ? 'Se a sua organização trabalha com MIPYMEs, com projectos financiados, ou com as duas coisas, aqui faz esse trabalho: diagnóstico e visitas, o projecto e o relatório ao financiador, os concursos, os cursos. Cada módulo contrata-se à parte. Em espanhol e português. Nos nossos servidores ou nos vossos.'
        : 'If your organisation works with MSMEs, funded projects, or both, this is where that work happens: diagnosis and visits, the project and the donor report, calls for funding, courses. Each module is licensed on its own. In Spanish and Portuguese. On our servers or yours.',

    values: es
      ? [
          {
            title: 'Eficiencia',
            body: 'Un lugar para finanzas, proyectos, fondos, asistencia técnica y formación, en lugar de cinco herramientas que no se hablan.',
          },
          {
            title: 'Acceso',
            body: 'Español y portugués. Precio y complejidad pensados para estas organizaciones, no para un ERP de otro mercado.',
          },
          {
            title: 'Procesos',
            body: 'Diagnóstico, ruta, evidencias, aprobaciones y reportes sobre el trabajo real — no un informe reconstruido al final.',
          },
        ]
      : pt
        ? [
            {
              title: 'Eficiência',
              body: 'Um sítio para finanças, projectos, fundos, assistência técnica e formação, em vez de cinco ferramentas que não se falam.',
            },
            {
              title: 'Acesso',
              body: 'Espanhol e português. Preço e complexidade pensados para estas organizações, não para um ERP de outro mercado.',
            },
            {
              title: 'Processos',
              body: 'Diagnóstico, rota, evidências, aprovações e relatórios sobre o trabalho real — não um relatório reconstruído no fim.',
            },
          ]
        : [
            {
              title: 'Efficiency',
              body: 'One place for finance, projects, funds, technical assistance and training, instead of five tools that do not talk.',
            },
            {
              title: 'Access',
              body: 'Spanish and Portuguese. Price and complexity built for these organisations, not for an ERP from another market.',
            },
            {
              title: 'Processes',
              body: 'Diagnosis, pathway, evidence, approvals and reports on the actual work — not a report rebuilt at the end.',
            },
          ],

    servicesKicker: es ? 'Qué ofrecemos' : pt ? 'O que oferecemos' : 'What we offer',
    servicesTitle: es
      ? 'Sistemas propios y soluciones a medida'
      : pt
        ? 'Sistemas próprios e soluções à medida'
        : 'Own systems and tailored solutions',
    servicesLead: es
      ? 'Contrate el sistema que necesita. Si usa más de uno, los datos se comparten. Si el problema es de campo, diseñamos método y equipo además del software.'
      : pt
        ? 'Contrate o sistema de que precisa. Se usar mais do que um, os dados partilham-se. Se o problema é de campo, desenhamos método e equipamento além do software.'
        : 'License the system you need. Use more than one and data is shared. If the problem is in the field, we design method and equipment as well as software.',

    serviceCards: es
      ? [
          {
            title: 'Sistemas propios',
            body: 'Cinco sistemas — ATLAS, SIEP, FUNDHUB, NEXUS y FORGE — más herramientas: Advisor, Studio, Work, Chorus y Prism. Contrate solo lo que necesita hoy.',
            cta: 'Ver sistemas',
            href: '#sistemas',
          },
          {
            title: 'Soluciones personalizadas',
            body: 'Cuando el problema está en el campo — un proceso, un equipo, una forma de producir — diseñamos la solución completa: método, dispositivo y software que deja evidencia.',
            cta: 'Hablemos',
            href: '#contacto',
          },
          {
            title: 'Dónde corre',
            body: 'En nuestros servidores o en los de la organización.',
            cta: 'Solicitar demostración',
            href: 'mailto:hola@etholys.com?subject=Demostraci%C3%B3n%20Etholys',
          },
        ]
      : pt
        ? [
            {
              title: 'Sistemas próprios',
              body: 'Cinco sistemas — ATLAS, SIEP, FUNDHUB, NEXUS e FORGE — mais ferramentas: Advisor, Studio, Work, Chorus e Prism. Contrate apenas o que precisa hoje.',
              cta: 'Ver sistemas',
              href: '#sistemas',
            },
            {
              title: 'Soluções personalizadas',
              body: 'Quando o problema está no campo — um processo, um equipamento, uma forma de produzir — desenhamos a solução completa: método, dispositivo e software que deixa evidência.',
              cta: 'Fale connosco',
              href: '#contacto',
            },
            {
              title: 'Onde corre',
              body: 'Nos nossos servidores ou nos da organização.',
              cta: 'Solicitar demonstração',
              href: 'mailto:hola@etholys.com?subject=Demonstra%C3%A7%C3%A3o%20Etholys',
            },
          ]
        : [
            {
              title: 'Proprietary systems',
              body: 'Five systems — ATLAS, SIEP, FUNDHUB, NEXUS and FORGE — plus tools: Advisor, Studio, Work, Chorus and Prism. License only what you need today.',
              cta: 'See systems',
              href: '#sistemas',
            },
            {
              title: 'Tailored solutions',
              body: 'When the problem is in the field — a process, equipment, a way of producing — we design the full solution: method, device and software that leaves evidence.',
              cta: 'Let’s talk',
              href: '#contacto',
            },
            {
              title: 'Where it runs',
              body: 'On our servers or the organisation’s.',
              cta: 'Request a demo',
              href: 'mailto:hola@etholys.com?subject=Etholys%20demo',
            },
          ],

    systemsKicker: es ? 'Sistemas' : pt ? 'Sistemas' : 'Systems',
    systemsTitle: es
      ? 'Seis productos. Cada uno con su trabajo.'
      : pt
        ? 'Seis produtos. Cada um com o seu trabalho.'
        : 'Six products. Each with its own job.',
    systemsLead: es
      ? 'Funcionan por separado. Cuando los combina, los datos se cruzan sin duplicar información.'
      : pt
        ? 'Funcionam em separado. Quando os combina, os dados cruzam-se sem duplicar informação.'
        : 'They work on their own. Combine them and data connects without duplication.',

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
            <a href="#sobre" className="transition hover:text-white">
              {t.navAbout}
            </a>
            <a href="#servicios" className="transition hover:text-white">
              {t.navServices}
            </a>
            <a href="#sistemas" className="transition hover:text-white">
              {t.navSystems}
            </a>
            <a href="#contacto" className="transition hover:text-white">
              {t.demo}
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

      {/* Hero */}
      <section id="inicio" className="relative isolate min-h-[92svh] overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_20%,rgba(13,148,136,0.28),transparent_55%),radial-gradient(90%_70%_at_10%_90%,rgba(15,23,42,0.9),transparent_50%),linear-gradient(165deg,#041018_0%,#0B1C24_42%,#07111A_100%)]"
        />
        <div aria-hidden className="etholys-site-grid absolute inset-0 opacity-[0.18]" />
        <div
          aria-hidden
          className="etholys-site-orbit absolute -right-[18%] top-[8%] h-[70vmin] w-[70vmin] rounded-full border border-teal-400/20"
        />

        <div
          id="contenido"
          className="relative mx-auto flex min-h-[92svh] max-w-6xl flex-col justify-end px-5 pb-16 pt-28 sm:px-8 sm:pb-24 lg:justify-center lg:pb-20"
        >
          <div className="etholys-site-rise max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-400/90">{t.factory}</p>
            <h1 className="mt-4 font-[family-name:var(--font-etholys-display)] text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
              {t.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">{t.support}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#sobre"
                className="inline-flex items-center rounded-md bg-teal-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
              >
                {t.navAbout}
              </a>
              <a
                href="mailto:hola@etholys.com?subject=Demostraci%C3%B3n%20Etholys"
                className="inline-flex items-center rounded-md border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
              >
                {t.demo}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* About + values */}
      <section id="sobre" className="relative border-t border-white/10 bg-[#08131C] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-400/90">{t.aboutKicker}</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-etholys-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.aboutTitle}
          </h2>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/65 sm:text-lg">{t.aboutBody}</p>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {t.values.map((value) => (
              <div key={value.title} className="border border-white/10 bg-[#0C1822] p-6">
                <h3 className="font-[family-name:var(--font-etholys-display)] text-lg font-semibold text-white">
                  {value.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{value.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="servicios" className="border-t border-white/10 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-400/90">{t.servicesKicker}</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-etholys-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.servicesTitle}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">{t.servicesLead}</p>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {t.serviceCards.map((card) => (
              <div key={card.title} className="flex flex-col border border-white/10 bg-[#0C1822] p-6">
                <h3 className="font-[family-name:var(--font-etholys-display)] text-xl font-semibold text-white">
                  {card.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-white/55">{card.body}</p>
                <a
                  href={card.href}
                  className="mt-6 inline-flex text-sm font-semibold text-teal-400 transition hover:text-teal-300"
                >
                  {card.cta} →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Systems — single mention */}
      <section id="sistemas" className="border-t border-white/10 bg-[#08131C] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-400/90">{t.systemsKicker}</p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-etholys-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.systemsTitle}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">{t.systemsLead}</p>

          <div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEMS.map((sys) => (
              <div key={sys.id} className="bg-[#07111A] p-6">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: sys.accent }} />
                  <h3 className="font-[family-name:var(--font-etholys-display)] text-lg font-semibold tracking-wide text-white">
                    {sys.name}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{sys.tagline[locale]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contacto" className="border-t border-white/10 bg-[#041018] py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-400/90">{t.contactKicker}</p>
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
