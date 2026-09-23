'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  HandCoins,
  Layers,
  LogIn,
} from 'lucide-react';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { FundHubProductStage, type StageView } from '@/components/briefing/FundHubProductStage';
import { cn } from '@/lib/utils';

const DEMO_HREF = '/login?callbackUrl=/hub/fundhub';

type Slide = {
  id: string;
  accent: 'teal' | 'amber';
  kicker: string;
  title: string;
  body?: string;
  stage?: StageView;
  cards?: { title: string; text: string; tone?: 'no' | 'yes' | 'amber' | 'teal' }[];
};

const SLIDES: Slide[] = [
  {
    id: 'cover',
    accent: 'amber',
    kicker: 'Etholys · FundHub',
    title: 'Encontrar fondos.\nDecidir. Postular.',
    body: 'La captación institucional — buscar convocatorias, decidir en equipo y escribir la candidatura — en un solo expediente.',
    stage: 'home',
  },
  {
    id: 'what',
    accent: 'amber',
    kicker: 'Qué es',
    title: 'El trabajo de captación.\nNo otra herramienta suelta.',
    body: 'Encontrar en fuentes oficiales, validar con criterio humano, guardar las que importan y construir la candidatura sobre el fondo ya encontrado — con el perfil a la vista.',
    cards: [
      { title: 'Buscar', text: 'La IA encuentra. Usted decide.', tone: 'amber' },
      { title: 'En curso', text: 'Lo que ya guardó y sus plazos.', tone: 'amber' },
      { title: 'Propuestas', text: 'Idea, chat y documento.', tone: 'amber' },
    ],
    stage: 'home',
  },
  {
    id: 'not',
    accent: 'teal',
    kicker: 'Qué no es',
    title: 'No es un buscador con otro nombre.',
    cards: [
      { title: 'No es un buscador de internet', text: 'Se priorizan enlaces oficiales. No se vende un agregador.', tone: 'no' },
      { title: 'No es un Excel compartido', text: 'Portafolio, plazos y lo descartado viven aquí.', tone: 'no' },
      { title: 'No es un redactor genérico de IA', text: 'La candidatura nace del fondo y del perfil reales.', tone: 'no' },
      { title: 'Sí: captación institucional', text: 'Una firma. Toda la red. Español y portugués.', tone: 'yes' },
    ],
  },
  {
    id: 'problem',
    accent: 'teal',
    kicker: 'El problema',
    title: 'Las convocatorias existen.\nEl trabajo está partido.',
    cards: [
      { title: 'Hoy', text: 'Portales, una hoja, Word sin el edital, compliance en otra carpeta, socios en la cabeza de alguien. Cuando llega el plazo hay personas ocupadas — no un portafolio.', tone: 'no' },
      { title: 'Con FundHub', text: 'Un rastro. Un expediente. No promete ganar más fondos por magia. Promete que buscar, decidir, postular y dejar expediente dejen de estar partidos.', tone: 'yes' },
    ],
  },
  {
    id: 'who',
    accent: 'teal',
    kicker: 'Para quién',
    title: 'Lo contrata una institución.\nLo usa su red.',
    cards: [
      { title: 'Quien firma', text: 'ONG, fundaciones, institutos, universidades. Agencias y operadores de fondo — como el PNUD — que necesitan ver la cartera.', tone: 'teal' },
      { title: 'Quien ejecuta debajo', text: 'Subproyecto, empresa atendida, socio de consorcio. Dentro de ese contrato. No otra cuenta como si fuera otro cliente.', tone: 'amber' },
      { title: 'Por qué importa', text: 'Una firma. Una red. Un rastro. El próximo programa no debería exigir otra hoja y otro Word.', tone: 'amber' },
    ],
  },
  {
    id: 'flow',
    accent: 'amber',
    kicker: 'El flujo',
    title: 'Tres pasos. Nada más.',
    body: 'El menú no es un catálogo de módulos. Es el trabajo. Pulse los verbos — es la misma pantalla del producto.',
    stage: 'home',
  },
  {
    id: 'search',
    accent: 'amber',
    kicker: '01 · Buscar',
    title: 'La IA encuentra.\nUsted decide.',
    body: 'Temas, países, tipo, techo de monto. Fuentes oficiales. Cada candidato llega listo para decidir. Pulse una ficha.',
    stage: 'search',
  },
  {
    id: 'pipeline',
    accent: 'amber',
    kicker: '02 · En curso',
    title: 'No es otra búsqueda.\nEs el portafolio.',
    body: 'Plazos, institución, siguiente paso. El equipo ve lo mismo. De aquí se abre la propuesta sin pedir el edital otra vez.',
    stage: 'pipeline',
  },
  {
    id: 'proposal',
    accent: 'amber',
    kicker: '03 · Propuestas',
    title: 'El fondo ya está.\nLa candidatura no parte de cero.',
    body: 'Lluvia de ideas para ese fondo y este perfil. Pulse una idea: entra al canvas. El rastro queda.',
    stage: 'proposal',
  },
  {
    id: 'around',
    accent: 'amber',
    kicker: 'El expediente',
    title: 'El financiador no compra un PowerPoint.',
    cards: [
      { title: 'Perfil', text: 'Nombre, sector, país, intereses. Quien administra lo edita. Si falta algo, una línea lo señala.', tone: 'amber' },
      { title: 'Mapa', text: 'La cartera ya guardada: país, sector, plazo.', tone: 'amber' },
      { title: 'Compliance', text: 'Gobernanza, auditoría, ESG, legal. El rastro — no sustituye a un abogado.', tone: 'amber' },
      { title: 'Coalición y socios', text: 'El consorcio del edital y la red local, sin duplicar datos.', tone: 'amber' },
    ],
    stage: 'profile',
  },
  {
    id: 'ai',
    accent: 'teal',
    kicker: 'La IA, en su lugar',
    title: 'La IA no es el producto.\nEstá dentro del trabajo.',
    cards: [
      { title: 'Hace', text: 'Busca. Resume. Propone una idea. Escribe junto al documento.', tone: 'yes' },
      { title: 'No hace', text: 'No postula sola. No firma. No inventa un financiador. La decisión sigue siendo humana.', tone: 'no' },
    ],
  },
  {
    id: 'scale',
    accent: 'teal',
    kicker: 'A escala',
    title: 'Se licencia y se vuelve a usar.',
    cards: [
      { title: 'Solo FundHub', text: 'No exige ATLAS, SIEP, NEXUS ni el resto. Si ya hay otros productos Etholys, los datos se cruzan.', tone: 'teal' },
      { title: 'Multi-empresa', text: 'Cada programa o red ve su cartera. Quien ejecuta debajo, dentro del contrato de quien firmó.', tone: 'teal' },
      { title: 'ES y PT', text: 'En servidores Etholys o en los de la institución.', tone: 'teal' },
    ],
  },
  {
    id: 'demo',
    accent: 'amber',
    kicker: 'Momento demostración',
    title: 'Horizonte, en vivo.',
    body: 'Tres minutos en el producto real. Buscar → guardar → propuesta. Si la búsqueda falla, se ve el reintento. Eso también es FundHub.',
    stage: 'search',
  },
  {
    id: 'close',
    accent: 'amber',
    kicker: 'Cierre',
    title: 'El ciclo deja de estar partido.',
    body: 'Buscar. Decidir. Postular. Un expediente para quien firma — y para quien ejecuta debajo.',
    cards: [
      { title: 'ONG', text: 'Un rastro compartido. Menos Word suelto.', tone: 'amber' },
      { title: 'PNUD', text: 'Cartera visible. Una red, un contrato.', tone: 'teal' },
      { title: 'Siguiente paso', text: 'Probar FundHub con un programa real.', tone: 'yes' },
    ],
  },
];

export function FundHubBriefing() {
  const [i, setI] = useState(0);
  const [stageOverride, setStageOverride] = useState<StageView | null>(null);
  const slide = SLIDES[i];
  const stage = stageOverride ?? slide.stage;

  const go = useCallback((next: number) => {
    setStageOverride(null);
    setI(Math.max(0, Math.min(SLIDES.length - 1, next)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        go(i + 1);
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(i - 1);
      }
      if (e.key === 'Home') go(0);
      if (e.key === 'End') go(SLIDES.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, i]);

  return (
    <div
      className={cn(
        'relative isolate min-h-[100dvh] overflow-hidden bg-[#07111A] text-[#E8EEF2]',
        slide.accent === 'amber' ? 'etholys-fundhub' : 'etholys-hub',
      )}
    >
      <SystemAtmosphere accent={slide.accent} />

      <header className="relative z-20 border-b border-white/10 bg-[#07111A]/55 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border',
                slide.accent === 'amber'
                  ? 'border-amber-400/30 bg-amber-500/15'
                  : 'border-teal-400/25 bg-teal-500/10',
              )}
            >
              {slide.accent === 'amber' ? (
                <HandCoins className="h-4 w-4 text-amber-300" strokeWidth={1.75} />
              ) : (
                <Layers className="h-4 w-4 text-teal-300" />
              )}
            </div>
            <p className="font-[family-name:var(--font-etholys-display)] text-sm font-bold tracking-[0.16em] text-white">
              {slide.accent === 'amber' ? 'FundHub' : 'ETHOLYS'}
            </p>
            <span className="hidden text-xs text-white/35 sm:inline">briefing · 15 min</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={DEMO_HREF}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              <LogIn className="h-3.5 w-3.5" />
              Entrar al Hub
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100dvh-7.5rem)] max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
        <div key={slide.id} className="etholys-site-rise">
          <p
            className={cn(
              'text-xs font-semibold tracking-[0.22em]',
              slide.accent === 'amber' ? 'text-amber-400/90' : 'text-teal-400/90',
            )}
          >
            {slide.kicker}
          </p>
          <h1 className="mt-3 whitespace-pre-line font-[family-name:var(--font-etholys-display)] text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            {slide.title}
          </h1>
          {slide.body && <p className="mt-4 max-w-xl text-base leading-relaxed text-white/55">{slide.body}</p>}
          {slide.cards && (
            <div className={cn('mt-6 grid gap-3', slide.cards.length > 3 ? 'sm:grid-cols-2' : 'sm:grid-cols-1')}>
              {slide.cards.map((c) => (
                <div
                  key={c.title}
                  className={cn(
                    'rounded-2xl border p-4',
                    c.tone === 'yes' && 'border-teal-400/20 bg-teal-500/10',
                    c.tone === 'no' && 'border-white/10 bg-[#0C1822]/70',
                    c.tone === 'amber' && 'border-white/10 bg-[#0C1822]/80 hover:border-amber-400/30',
                    c.tone === 'teal' && 'border-white/10 bg-[#0C1822]/80',
                    !c.tone && 'border-white/10 bg-[#0C1822]/70',
                  )}
                >
                  <p className="font-[family-name:var(--font-etholys-display)] text-sm text-white">{c.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/50">{c.text}</p>
                </div>
              ))}
            </div>
          )}
          {slide.id === 'demo' && (
            <Link
              href={DEMO_HREF}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400"
            >
              Abrir FundHub con Horizonte
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        <div className={cn(!stage && 'hidden lg:block')}>
          {stage ? (
            <FundHubProductStage view={stage} onView={setStageOverride} />
          ) : (
            <div className="hidden rounded-2xl border border-white/10 bg-[#0C1822]/40 p-6 lg:block">
              <p className="text-xs tracking-[0.18em] text-white/30">ETHOLYS</p>
              <p className="mt-3 font-[family-name:var(--font-etholys-display)] text-lg text-white/70">
                Un ecosistema. Un acceso. FundHub se contrata solo.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="relative z-20 border-t border-white/10 bg-[#07111A]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => go(i - 1)}
            disabled={i === 0}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-white/50 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Anterior
          </button>
          <div className="flex flex-wrap justify-center gap-1.5">
            {SLIDES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(idx)}
                aria-label={s.kicker}
                className={cn(
                  'h-1.5 rounded-full transition',
                  idx === i ? 'w-6 bg-amber-400' : 'w-1.5 bg-white/20 hover:bg-white/40',
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-white/30 sm:inline">
              {String(i + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
            </span>
            {i < SLIDES.length - 1 ? (
              <button
                type="button"
                onClick={() => go(i + 1)}
                className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
              >
                Siguiente
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Link
                href={DEMO_HREF}
                className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-slate-950"
              >
                Demo
                <LogIn className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
