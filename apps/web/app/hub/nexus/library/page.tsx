'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BookOpen, ClipboardCheck, FileJson, History, Route, Sparkles, Rocket } from 'lucide-react';
import { useApp } from '@/app/providers';
import { touchRunwayChapter } from '@/lib/nexus-runway';

function NexusLibraryInner() {
  const { locale } = useApp();
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');
  const withNet = (href: string) =>
    networkId ? `${href.split('?')[0]}?network=${encodeURIComponent(networkId)}` : href;

  useEffect(() => {
    touchRunwayChapter('library');
  }, []);

  const t = {
    title:
      locale === 'es' ? 'Biblioteca Nexus' : locale === 'pt' ? 'Biblioteca Nexus' : 'Nexus library',
    subtitle:
      locale === 'es'
        ? 'Método, enlaces útiles y cómo extender el diagnóstico.'
        : locale === 'pt'
          ? 'Método, links úteis e como estender o diagnóstico.'
          : 'Method, useful links, and how to extend the diagnostic.',
    cycle:
      locale === 'es'
        ? 'Ciclo recomendado'
        : locale === 'pt'
          ? 'Ciclo recomendado'
          : 'Recommended cycle',
    cycleBody:
      locale === 'es'
        ? 'Visión general → cuestionario por sectores → acciones en la ruta viva → tickets de servicio cuando necesite apoyo interno.'
        : locale === 'pt'
          ? 'Visão geral → questionário por setores → ações na rota viva → tickets de serviço quando precisar de apoio interno.'
          : 'Overview → sector questionnaire → live roadmap actions → internal service tickets when you need support.',
    extend:
      locale === 'es'
        ? 'Extender el cuestionario'
        : locale === 'pt'
          ? 'Estender o questionário'
          : 'Extend the questionnaire',
    extendBody:
      locale === 'es'
        ? 'Coloque un archivo quiz.json en apps/web/data/nexus-diagnostic/ (ver documentación del API). El sistema lo cargará automáticamente.'
        : locale === 'pt'
          ? 'Coloque o arquivo quiz.json em apps/web/data/nexus-diagnostic/. O app carrega automaticamente via API.'
          : 'Place a quiz.json file under apps/web/data/nexus-diagnostic/. The app loads it automatically via the API.',
    links: locale === 'es' ? 'Accesos rápidos' : locale === 'pt' ? 'Acessos rápidos' : 'Quick links',
  };

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2 text-violet-700">
          <BookOpen className="h-6 w-6" />
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">{t.subtitle}</p>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t.cycle}</h2>
        <p className="mt-2 text-sm text-gray-700">{t.cycleBody}</p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-gray-900">
          <FileJson className="h-5 w-5 text-violet-600" />
          <h2 className="font-semibold">{t.extend}</h2>
        </div>
        <p className="mt-2 text-sm text-gray-600">{t.extendBody}</p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{t.links}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={withNet('/hub/nexus/journey')}
            className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm transition hover:border-violet-300 hover:bg-violet-50"
          >
            <Rocket className="mt-0.5 h-5 w-5 text-violet-700" />
            <div>
              <p className="font-medium text-gray-900">Fase e metas (NEXUS)</p>
              <p className="text-xs text-gray-600">O mesmo processo: alinhar fase, regiões e checklists</p>
            </div>
          </Link>
          <Link
            href={withNet('/hub/nexus/diagnosis')}
            className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/40"
          >
            <ClipboardCheck className="mt-0.5 h-5 w-5 text-violet-600" />
            <div>
              <p className="font-medium text-gray-900">Diagnóstico</p>
              <p className="text-xs text-gray-500">Questionário por setores</p>
            </div>
          </Link>
          <Link
            href={withNet('/hub/nexus/history')}
            className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/40"
          >
            <History className="mt-0.5 h-5 w-5 text-violet-600" />
            <div>
              <p className="font-medium text-gray-900">Histórico de diagnósticos</p>
              <p className="text-xs text-gray-500">Snapshots locais por contexto</p>
            </div>
          </Link>
          <Link
            href={withNet('/hub/nexus/roadmap')}
            className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/40"
          >
            <Route className="mt-0.5 h-5 w-5 text-violet-600" />
            <div>
              <p className="font-medium text-gray-900">Rota viva</p>
              <p className="text-xs text-gray-500">Ações priorizadas</p>
            </div>
          </Link>
          <Link
            href={withNet('/hub/nexus/services')}
            className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/40"
          >
            <Sparkles className="mt-0.5 h-5 w-5 text-violet-600" />
            <div>
              <p className="font-medium text-gray-900">Serviços internos</p>
              <p className="text-xs text-gray-500">Tickets Etholys</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function NexusLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-600" />
        </div>
      }
    >
      <NexusLibraryInner />
    </Suspense>
  );
}
