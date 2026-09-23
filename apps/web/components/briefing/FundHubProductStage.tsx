'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  HandCoins,
  Handshake,
  Heart,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ScanProgressRing } from '@/components/opportunity/ScanProgressRing';
import { cn } from '@/lib/utils';

export type StageView = 'home' | 'search' | 'pipeline' | 'proposal' | 'profile';

const NAV = [
  { id: 'home', icon: LayoutDashboard, label: 'Resumen' },
  { id: 'search', icon: Search, label: 'Buscar' },
  { id: 'pipeline', icon: Heart, label: 'En curso' },
  { id: 'proposal', icon: Lightbulb, label: 'Propuestas' },
  { id: 'profile', icon: Building2, label: 'Perfil' },
  { id: 'map', icon: MapPin, label: 'Mapa' },
  { id: 'compliance', icon: ShieldCheck, label: 'Compliance' },
  { id: 'coalition', icon: Users, label: 'Coalición' },
  { id: 'partners', icon: Handshake, label: 'Socios' },
] as const;

const CANDIDATES = [
  {
    name: 'Fondo verde de adaptación',
    meta: 'CAF · grant · cierra 18 oct',
    score: 82,
    saved: true,
    detail: 'Quién puede postular · elegibilidad · requisitos · cómo aplicar · riesgos',
  },
  {
    name: 'Línea de crédito cooperativo',
    meta: 'BID · crédito · ventana continua',
    score: 54,
    saved: false,
    detail: 'Puente con clientes. La ONG articula; no se endeuda.',
  },
  {
    name: 'Alianza de compras públicas',
    meta: 'Municipio · alianza · abierto',
    score: 71,
    saved: false,
    detail: 'Ancla local. Sirve a la coalición, no a una búsqueda suelta.',
  },
];

const IDEAS = [
  'Alinear el programa rural con adaptación climática.',
  'Evidenciar la red de cooperativas socias.',
  'Llevar gobernanza y compliance ya documentados.',
  'Proponer indicadores a 12 meses sin inventar porcentajes.',
];

export function FundHubProductStage({
  view,
  onView,
}: {
  view: StageView;
  onView?: (v: StageView) => void;
}) {
  const [scan, setScan] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [picked, setPicked] = useState(0);
  const [inserted, setInserted] = useState<number[]>([]);

  useEffect(() => {
    if (view !== 'search') {
      setScanning(false);
      return;
    }
    setScan(8);
    setScanning(true);
    const t = window.setInterval(() => {
      setScan((p) => {
        if (p >= 100) {
          window.clearInterval(t);
          setScanning(false);
          return 100;
        }
        return p + 7;
      });
    }, 180);
    return () => window.clearInterval(t);
  }, [view]);

  const activeNav =
    view === 'home' ? 'home' : view === 'search' ? 'search' : view === 'pipeline' ? 'pipeline' : view === 'proposal' ? 'proposal' : 'profile';

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0C1822]/80 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <p className="ml-2 truncate font-[family-name:var(--font-etholys-display)] text-[11px] tracking-wide text-white/35">
          etholys.com/hub/fundhub
        </p>
      </div>
      <div className="flex min-h-[22rem] md:min-h-[26rem]">
        <aside className="hidden w-44 shrink-0 border-r border-white/10 bg-[#07111A]/88 p-2.5 sm:block">
          <div className="mb-3 flex items-center gap-2 px-1.5 py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/15">
              <HandCoins className="h-3.5 w-3.5 text-amber-300" strokeWidth={1.75} />
            </div>
            <span className="font-[family-name:var(--font-etholys-display)] text-xs font-bold tracking-wide text-white">
              FundHub
            </span>
          </div>
          <p className="mb-2 truncate rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-white/70">
            Horizonte
          </p>
          {NAV.map((item, i) => {
            const Icon = item.icon;
            const active = item.id === activeNav;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'home' || item.id === 'search' || item.id === 'pipeline' || item.id === 'proposal' || item.id === 'profile') {
                    onView?.(item.id);
                  }
                }}
                className={cn(
                  'mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition',
                  active ? 'bg-amber-500/15 text-amber-100' : 'text-white/50 hover:bg-white/[0.05] hover:text-white',
                  i === 4 && 'mt-2 border-t border-white/10 pt-2',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </aside>
        <div className="min-w-0 flex-1 p-4 md:p-5">
          {view === 'home' && <HomePane />}
          {view === 'search' && (
            <SearchPane scan={scan} scanning={scanning} picked={picked} onPick={setPicked} />
          )}
          {view === 'pipeline' && <PipelinePane />}
          {view === 'proposal' && (
            <ProposalPane inserted={inserted} onInsert={(i) => setInserted((prev) => (prev.includes(i) ? prev : [...prev, i]))} />
          )}
          {view === 'profile' && <ProfilePane />}
        </div>
      </div>
    </div>
  );
}

function HomePane() {
  const cards = [
    { n: '1', title: 'Buscar', detail: 'La IA encuentra. Usted decide.' },
    { n: '2', title: 'En curso', detail: 'Lo que ya guardó y sus plazos.' },
    { n: '3', title: 'Propuestas', detail: 'Idea, chat y documento.' },
  ];
  return (
    <div className="etholys-site-rise space-y-4">
      <section className="rounded-2xl border border-white/10 bg-[#0C1822]/80 p-5">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-amber-400/90">FundHub</p>
        <h3 className="mt-2 font-[family-name:var(--font-etholys-display)] text-2xl font-semibold text-white">
          Buscar. Decidir. Postular.
        </h3>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950"
        >
          <Search className="h-3.5 w-3.5" />
          Empezar a buscar
        </button>
      </section>
      <div className="grid gap-2 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.n} className="rounded-2xl border border-white/10 bg-[#0C1822]/70 p-3">
            <p className="text-[10px] text-white/35">{c.n}</p>
            <p className="mt-1 font-[family-name:var(--font-etholys-display)] text-sm text-white">{c.title}</p>
            <p className="mt-1 text-[11px] text-white/45">{c.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchPane({
  scan,
  scanning,
  picked,
  onPick,
}: {
  scan: number;
  scanning: boolean;
  picked: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="etholys-site-rise space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {['Grant', 'Uruguay', 'Rural', 'Oficiales', 'Directo'].map((c) => (
          <span key={c} className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-0.5 text-[11px] text-amber-200">
            {c}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-white/50">
          <ScanProgressRing percent={scan} state={scanning ? 'running' : 'done'} size={22} tone="onDark" />
          {scanning ? 'Recorriendo fuentes oficiales…' : '3 candidatos · usted decide'}
        </span>
      </div>
      <div className="space-y-2">
        {CANDIDATES.map((row, i) => (
          <button
            key={row.name}
            type="button"
            onClick={() => onPick(i)}
            className={cn(
              'w-full rounded-xl border p-3 text-left transition',
              picked === i
                ? 'border-amber-400/40 bg-amber-500/10'
                : 'border-white/10 bg-[#0C1822]/70 hover:border-amber-400/25',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{row.name}</p>
                <p className="mt-0.5 text-[11px] text-white/45">{row.meta}</p>
                {picked === i && <p className="mt-2 text-[11px] text-white/55">{row.detail}</p>}
              </div>
              <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-200">{row.score}</span>
            </div>
            {row.saved && <p className="mt-2 text-[11px] font-medium text-teal-300">Guardado en En curso</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

function PipelinePane() {
  return (
    <div className="etholys-site-rise space-y-3">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-amber-400/90">En curso</p>
      <h3 className="font-[family-name:var(--font-etholys-display)] text-xl text-white">El portafolio. No otra búsqueda.</h3>
      <div className="rounded-xl border border-white/10 bg-[#0C1822]/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Fondo verde de adaptación</p>
            <p className="mt-1 text-[11px] text-white/45">CAF · grant · siguiente: abrir propuesta</p>
          </div>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-200">18 oct</span>
        </div>
        <button type="button" className="mt-4 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950">
          Escribir propuesta
        </button>
      </div>
    </div>
  );
}

function ProposalPane({
  inserted,
  onInsert,
}: {
  inserted: number[];
  onInsert: (i: number) => void;
}) {
  return (
    <div className="etholys-site-rise grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-[#0C1822]/70 p-3">
        <p className="text-[11px] font-semibold text-amber-300">Lluvia de ideas</p>
        <div className="mt-3 space-y-2">
          {IDEAS.map((idea, i) => (
            <button
              key={idea}
              type="button"
              onClick={() => onInsert(i)}
              className={cn(
                'w-full rounded-lg border px-3 py-2 text-left text-[12px] transition',
                inserted.includes(i)
                  ? 'border-teal-400/30 bg-teal-500/10 text-teal-100'
                  : 'border-white/10 text-white/70 hover:border-amber-400/30 hover:text-white',
              )}
            >
              {i + 1}. {idea}
              <span className="mt-1 block text-[10px] text-white/35">
                {inserted.includes(i) ? 'Insertado en el canvas' : 'Clic para insertar'}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-[#07111A]/70 p-3">
        <p className="text-[11px] font-semibold text-white/50">Documento</p>
        <p className="mt-2 text-sm font-semibold text-white">Propuesta · Fondo verde de adaptación</p>
        <ol className="mt-3 space-y-2 text-[12px] text-white/55">
          <li>1. Contexto y alineación</li>
          <li>2. Objetivos y resultados</li>
          <li>3. Actividades y cronograma</li>
          <li>4. Equipo y coalición</li>
          <li>5. Presupuesto</li>
        </ol>
        {inserted.length > 0 && (
          <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-500/10 p-2 text-[11px] text-amber-100">
            {inserted.length} idea{inserted.length > 1 ? 's' : ''} en el canvas. El rastro queda.
          </p>
        )}
      </div>
    </div>
  );
}

function ProfilePane() {
  const items = [
    ['Nombre', 'Horizonte'],
    ['Sector', 'Desarrollo rural'],
    ['País', 'Uruguay / regional'],
    ['Intereses', 'Adaptación, cooperativas, formación'],
  ];
  return (
    <div className="etholys-site-rise space-y-3">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-amber-400/90">Perfil institucional</p>
      <h3 className="font-[family-name:var(--font-etholys-display)] text-xl text-white">
        El financiador compra a quiénes son.
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/10 bg-[#0C1822]/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-white/35">{k}</p>
            <p className="mt-0.5 text-sm text-white">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
