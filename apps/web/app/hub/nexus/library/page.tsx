'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BookOpen, ClipboardCheck, History, Route, Sparkles, Rocket } from 'lucide-react';
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
        ? 'Método, enlaces y cómo seguir el diagnóstico.'
        : locale === 'pt'
          ? 'Método, ligações e como seguir o diagnóstico.'
          : 'Method, links, and how to continue the diagnostic.',
    cycle:
      locale === 'es'
        ? 'Ciclo recomendado'
        : locale === 'pt'
          ? 'Ciclo recomendado'
          : 'Recommended cycle',
    cycleBody:
      locale === 'es'
        ? 'Visión general → cuestionario por sectores → acciones en la ruta → servicios de apoyo cuando los necesite.'
        : locale === 'pt'
          ? 'Visão geral → questionário por setores → ações na rota → serviços de apoio quando precisar.'
          : 'Overview → sector questionnaire → roadmap actions → support services when you need them.',
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
              <p className="text-xs text-gray-500">
                {locale === 'es' ? 'Diagnósticos anteriores' : locale === 'en' ? 'Previous diagnostics' : 'Diagnósticos anteriores'}
              </p>
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
              <p className="font-medium text-gray-900">
                {locale === 'es' ? 'Servicios de apoyo' : locale === 'en' ? 'Support services' : 'Serviços de apoio'}
              </p>
              <p className="text-xs text-gray-500">
                {locale === 'es' ? 'Pedidos de asistencia' : locale === 'en' ? 'Assistance requests' : 'Pedidos de assistência'}
              </p>
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
