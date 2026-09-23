'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  FolderOpen,
  HandCoins,
  LogIn,
  Mail,
  Search,
} from 'lucide-react';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { FundHubProductStage, type StageView } from '@/components/briefing/FundHubProductStage';
import { cn } from '@/lib/utils';

const DEMO_HREF = '/login?callbackUrl=/hub/fundhub';

const PAIN = [
  {
    icon: Search,
    title: 'Alguien busca en tres portales.',
    desk: 'Twitter, un sitio del donante, otro del gobierno. Cada uno guarda un link distinto.',
  },
  {
    icon: FolderOpen,
    title: 'Otro mantiene una hoja.',
    desk: 'Nombre del fondo, fecha a ojo, “hay que ver”. Nadie sabe qué se descartó ni por qué.',
  },
  {
    icon: FileText,
    title: 'La propuesta se escribe en Word.',
    desk: 'Sin el edital a mano. El perfil institucional se pide por correo, otra vez.',
  },
  {
    icon: Mail,
    title: 'El financiador pide evidencia.',
    desk: 'Quiénes son, con quién se postulan, si la gobernanza está en orden. Eso no está junto a la convocatoria.',
  },
];

const VALUE = [
  {
    view: 'search' as StageView,
    title: 'Encuentra. Usted decide.',
    text: 'Convocatorias en fuentes oficiales. Elegibilidad, plazo, monto y riesgo. Guardar o descartar queda registrado.',
  },
  {
    view: 'pipeline' as StageView,
    title: 'El equipo ve lo mismo.',
    text: 'Un portafolio. Un plazo. El siguiente paso. No un correo suelto.',
  },
  {
    view: 'proposal' as StageView,
    title: 'La candidatura ya conoce el fondo.',
    text: 'Abre con el edital y el perfil de la institución. Idea, chat y documento en el mismo expediente.',
  },
];

export function FundHubBriefing() {
  const [i, setI] = useState(0);
  const [beat, setBeat] = useState(0);
  const [stage, setStage] = useState<StageView>('home');
  const [valuePick, setValuePick] = useState(0);

  const go = useCallback((next: number) => {
    const n = Math.max(0, Math.min(6, next));
    setI(n);
    setBeat(0);
    setValuePick(0);
    setStage(n === 0 ? 'home' : n === 4 ? 'profile' : n === 5 ? 'home' : 'search');
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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, i]);

  useEffect(() => {
    if (i !== 1) return;
    const t = window.setInterval(() => setBeat((b) => (b + 1) % PAIN.length), 3200);
    return () => window.clearInterval(t);
  }, [i]);

  return (
    <div className="etholys-fundhub relative isolate min-h-[100dvh] overflow-hidden bg-[#07111A] text-[#E8EEF2]">
      <SystemAtmosphere accent="amber" />

      <header className="relative z-20 border-b border-white/10 bg-[#07111A]/55 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/15">
              <HandCoins className="h-4 w-4 text-amber-300" strokeWidth={1.75} />
            </div>
            <p className="font-[family-name:var(--font-etholys-display)] text-sm font-bold tracking-wide text-white">
              FundHub
            </p>
          </div>
          <Link
            href={DEMO_HREF}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            <LogIn className="h-3.5 w-3.5" />
            Entrar al Hub
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto min-h-[calc(100dvh-7.25rem)] max-w-6xl px-4 py-6 sm:px-6">
        {i === 0 && <Cover onOpen={() => go(1)} />}
        {i === 1 && <Pain beat={beat} onBeat={setBeat} />}
        {i === 2 && (
          <Value
            pick={valuePick}
            onPick={(n) => {
              setValuePick(n);
              setStage(VALUE[n].view);
            }}
            stage={stage}
            onStage={setStage}
          />
        )}
        {i === 3 && <How stage={stage} onStage={setStage} />}
        {i === 4 && <Expediente stage={stage} onStage={setStage} />}
        {i === 5 && <Who />}
        {i === 6 && <Demo />}
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
          <div className="flex gap-1.5">
            {Array.from({ length: 7 }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => go(idx)}
                className={cn(
                  'h-1.5 rounded-full transition',
                  idx === i ? 'w-6 bg-amber-400' : 'w-1.5 bg-white/20 hover:bg-white/40',
                )}
              />
            ))}
          </div>
          {i < 6 ? (
            <button
              type="button"
              onClick={() => go(i + 1)}
              className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10"
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
      </footer>
    </div>
  );
}

function Cover({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="grid min-h-[calc(100dvh-9rem)] items-center gap-8 lg:grid-cols-2">
      <div className="etholys-site-rise">
        <p className="text-xs font-semibold tracking-[0.22em] text-amber-400/90">FundHub</p>
        <h1 className="mt-3 font-[family-name:var(--font-etholys-display)] text-4xl font-semibold leading-tight text-white sm:text-5xl">
          Encontrar fondos.
          <br />
          Decidir. Postular.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-white/65">
          De la convocatoria a la candidatura, sin perder el rastro.
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400"
        >
          El problema
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div className="etholys-site-rise" style={{ animationDelay: '120ms' }}>
        <FundHubProductStage view="home" />
      </div>
    </div>
  );
}

function Pain({ beat, onBeat }: { beat: number; onBeat: (n: number) => void }) {
  const active = PAIN[beat];
  const Icon = active.icon;
  return (
    <div className="grid min-h-[calc(100dvh-9rem)] items-center gap-8 lg:grid-cols-[1fr_1.05fr]">
      <div className="etholys-site-rise">
        <p className="text-xs font-semibold tracking-[0.22em] text-amber-400/90">El dolor</p>
        <h1 className="mt-3 font-[family-name:var(--font-etholys-display)] text-3xl font-semibold leading-tight text-white sm:text-4xl">
          El plazo llega.
          <br />
          El expediente no.
        </h1>
        <div className="mt-6 space-y-2">
          {PAIN.map((p, n) => (
            <button
              key={p.title}
              type="button"
              onClick={() => onBeat(n)}
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-left transition',
                n === beat
                  ? 'border-amber-400/35 bg-amber-500/10'
                  : 'border-white/10 bg-[#0C1822]/50 hover:border-white/20',
              )}
            >
              <p className={cn('text-sm font-medium', n === beat ? 'text-white' : 'text-white/50')}>{p.title}</p>
            </button>
          ))}
        </div>
      </div>
      <div
        key={beat}
        className="etholys-site-rise overflow-hidden rounded-2xl border border-white/10 bg-[#0C1822]/80 p-6 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.85)]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/15 text-amber-300">
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-5 font-[family-name:var(--font-etholys-display)] text-xl text-white">{active.title}</p>
        <p className="mt-3 text-base leading-relaxed text-white/55">{active.desk}</p>
        <div className="mt-6 flex gap-1.5">
          {PAIN.map((_, n) => (
            <span key={n} className={cn('h-1 flex-1 rounded-full', n === beat ? 'bg-amber-400' : 'bg-white/10')} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Value({
  pick,
  onPick,
  stage,
  onStage,
}: {
  pick: number;
  onPick: (n: number) => void;
  stage: StageView;
  onStage: (v: StageView) => void;
}) {
  return (
    <div className="grid min-h-[calc(100dvh-9rem)] items-center gap-8 lg:grid-cols-2">
      <div className="etholys-site-rise">
        <p className="text-xs font-semibold tracking-[0.22em] text-amber-400/90">El valor</p>
        <h1 className="mt-3 font-[family-name:var(--font-etholys-display)] text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Un rastro.
          <br />
          De punta a punta.
        </h1>
        <div className="mt-6 space-y-2">
          {VALUE.map((v, n) => (
            <button
              key={v.title}
              type="button"
              onClick={() => onPick(n)}
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-left transition',
                pick === n
                  ? 'border-amber-400/35 bg-amber-500/10'
                  : 'border-white/10 bg-[#0C1822]/50 hover:border-white/20',
              )}
            >
              <p className="text-sm font-semibold text-white">{v.title}</p>
              <p className={cn('mt-1 text-sm leading-relaxed', pick === n ? 'text-white/60' : 'text-white/40')}>
                {v.text}
              </p>
            </button>
          ))}
        </div>
      </div>
      <div className="etholys-site-rise" style={{ animationDelay: '80ms' }}>
        <FundHubProductStage view={stage} onView={onStage} playKey={`${pick}-${stage}`} />
      </div>
    </div>
  );
}

function How({ stage, onStage }: { stage: StageView; onStage: (v: StageView) => void }) {
  const steps: { view: StageView; n: string; title: string; text: string }[] = [
    { view: 'search', n: '1', title: 'Buscar', text: 'La IA recorre fuentes oficiales. Usted valida.' },
    { view: 'pipeline', n: '2', title: 'En curso', text: 'Lo que ya decidieron seguir. Plazos a la vista.' },
    { view: 'proposal', n: '3', title: 'Propuestas', text: 'El fondo ya está. Pulse una idea e insértela.' },
  ];
  return (
    <div className="etholys-site-rise min-h-[calc(100dvh-9rem)] space-y-5 py-2">
      <div>
        <p className="text-xs font-semibold tracking-[0.22em] text-amber-400/90">Cómo funciona</p>
        <h1 className="mt-2 font-[family-name:var(--font-etholys-display)] text-3xl font-semibold text-white">
          Tres verbos. El trabajo.
        </h1>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <button
            key={s.view}
            type="button"
            onClick={() => onStage(s.view)}
            className={cn(
              'rounded-2xl border p-4 text-left transition',
              stage === s.view
                ? 'border-amber-400/40 bg-amber-500/10'
                : 'border-white/10 bg-[#0C1822]/70 hover:border-amber-400/25',
            )}
          >
            <p className="text-[11px] text-white/35">{s.n}</p>
            <p className="mt-1 font-[family-name:var(--font-etholys-display)] text-lg text-white">{s.title}</p>
            <p className="mt-1 text-sm text-white/45">{s.text}</p>
          </button>
        ))}
      </div>
      <FundHubProductStage view={stage === 'home' ? 'search' : stage} onView={onStage} playKey={stage} />
    </div>
  );
}

function Expediente({ stage, onStage }: { stage: StageView; onStage: (v: StageView) => void }) {
  return (
    <div className="grid min-h-[calc(100dvh-9rem)] items-center gap-8 lg:grid-cols-2">
      <div className="etholys-site-rise">
        <p className="text-xs font-semibold tracking-[0.22em] text-amber-400/90">Lo que viaja con la propuesta</p>
        <h1 className="mt-3 font-[family-name:var(--font-etholys-display)] text-3xl font-semibold leading-tight text-white sm:text-4xl">
          El perfil, el compliance y la coalición ya están.
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-white/55">
          No se reconstruyen por correo. Abren con la candidatura. Pulse Perfil en el menú.
        </p>
      </div>
      <FundHubProductStage view={stage === 'home' ? 'profile' : stage} onView={onStage} playKey="profile" />
    </div>
  );
}

function Who() {
  return (
    <div className="etholys-site-rise mx-auto flex min-h-[calc(100dvh-9rem)] max-w-3xl flex-col justify-center">
      <p className="text-xs font-semibold tracking-[0.22em] text-amber-400/90">Quién lo usa</p>
      <h1 className="mt-3 font-[family-name:var(--font-etholys-display)] text-3xl font-semibold leading-tight text-white sm:text-4xl">
        Una firma. Toda la red.
      </h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0C1822]/80 p-5">
          <p className="font-[family-name:var(--font-etholys-display)] text-lg text-white">ONG, fundación, universidad</p>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            El equipo de captación deja de partir el trabajo. El implementador entra dentro del mismo contrato.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0C1822]/80 p-5">
          <p className="font-[family-name:var(--font-etholys-display)] text-lg text-white">PNUD y operadores</p>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Ven la cartera de quien ejecuta debajo. No abren una cuenta por socio.
          </p>
        </div>
      </div>
      <p className="mt-6 text-sm text-white/40">Se contrata solo FundHub. No exige el resto de Etholys.</p>
    </div>
  );
}

function Demo() {
  return (
    <div className="grid min-h-[calc(100dvh-9rem)] items-center gap-8 lg:grid-cols-2">
      <div className="etholys-site-rise">
        <p className="text-xs font-semibold tracking-[0.22em] text-amber-400/90">Horizonte</p>
        <h1 className="mt-3 font-[family-name:var(--font-etholys-display)] text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Tres minutos en el producto.
        </h1>
        <p className="mt-4 max-w-md text-base text-white/55">Buscar. Guardar. Abrir la propuesta. Eso es la demo.</p>
        <Link
          href={DEMO_HREF}
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400"
        >
          Entrar al Hub
          <LogIn className="h-4 w-4" />
        </Link>
      </div>
      <FundHubProductStage view="search" playKey="demo" />
    </div>
  );
}
