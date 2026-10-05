'use client';

import Link from 'next/link';
import { Factory, Leaf, Package, Radio, Truck } from 'lucide-react';
import { TRACE_STAGES, TRACE_STAGE_LABEL, type TraceStage } from '@/lib/radar/trace';
import { radarLoc, radarT, type RadarLoc } from '@/lib/radar/i18n';
import { spaceKindMeta } from '@/lib/radar/space';

export type OpsCanvasProperty = {
  id: string;
  name: string;
  moduleId: string | null;
  crop: string | null;
  unitCount: number;
  clientName: string | null;
};

export type OpsCanvasLot = {
  id: string;
  code: string;
  currentStage: TraceStage;
  status: string;
  unitName?: string | null;
};

export type OpsCanvasAlert = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  propertyId: string | null;
};

function slotFor(i: number, n: number) {
  if (n <= 1) return { x: 18, y: 22, w: 64, h: 48 };
  if (n === 2)
    return i === 0 ? { x: 8, y: 20, w: 40, h: 52 } : { x: 52, y: 20, w: 40, h: 52 };
  if (n === 3) {
    const s = [
      { x: 6, y: 14, w: 42, h: 40 },
      { x: 52, y: 14, w: 42, h: 40 },
      { x: 24, y: 58, w: 52, h: 30 },
    ];
    return s[i] || s[0];
  }
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const gap = 3;
  const cellW = (100 - gap * (cols + 1)) / cols;
  const cellH = (100 - gap * (rows + 1)) / rows;
  const col = i % cols;
  const row = Math.floor(i / cols);
  return {
    x: gap + col * (cellW + gap),
    y: gap + row * (cellH + gap),
    w: cellW,
    h: cellH * 0.9,
  };
}

function ModuleGlyph({ moduleId }: { moduleId: string | null }) {
  if (moduleId === 'agroindustry') return <Factory className="h-3.5 w-3.5" />;
  if (moduleId === 'livestock') return <Package className="h-3.5 w-3.5" />;
  return <Leaf className="h-3.5 w-3.5" />;
}

function zoneTone(moduleId: string | null) {
  if (moduleId === 'agroindustry') return 'bg-slate-500/25 border-slate-300/35';
  if (moduleId === 'livestock') return 'bg-amber-500/20 border-amber-300/35';
  if (moduleId === 'carbon') return 'bg-cyan-500/20 border-cyan-300/35';
  return 'bg-emerald-500/25 border-emerald-300/35';
}

/** SVG path through stage nodes for an open lot (home-level trail). */
export function RadarChainTrailBar({
  locale,
  stage,
  code,
}: {
  locale: string;
  stage: TraceStage;
  code?: string;
}) {
  const loc = radarLoc(locale);
  const cur = TRACE_STAGES.indexOf(stage);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
      {code && <span className="text-[11px] font-semibold text-emerald-200">{code}</span>}
      <ol className="flex flex-1 items-center gap-1">
        {TRACE_STAGES.map((s, i) => {
          const done = i <= cur;
          const active = i === cur;
          return (
            <li key={s} className="flex flex-1 items-center gap-1">
              <span
                className={`flex h-6 min-w-0 flex-1 items-center justify-center rounded-md text-[9px] font-medium ${
                  active
                    ? 'bg-emerald-500 text-[#04110c]'
                    : done
                      ? 'bg-emerald-500/25 text-emerald-100'
                      : 'bg-white/5 text-white/35'
                }`}
              >
                {TRACE_STAGE_LABEL[s][loc]}
              </span>
              {i < TRACE_STAGES.length - 1 && (
                <span className={`h-0.5 w-2 shrink-0 ${i < cur ? 'bg-emerald-400/70' : 'bg-white/15'}`} />
              )}
            </li>
          );
        })}
      </ol>
      <Truck className="h-3.5 w-3.5 shrink-0 text-white/40" />
    </div>
  );
}

export function RadarOpsCanvas({
  locale,
  properties,
  alerts,
  lots,
  selectedId,
  onSelect,
  hrefFor,
}: {
  locale: string;
  properties: OpsCanvasProperty[];
  alerts: OpsCanvasAlert[];
  lots: OpsCanvasLot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hrefFor: (id: string) => string;
}) {
  const loc: RadarLoc = radarLoc(locale);
  const openLot = lots.find((l) => l.status === 'open') || lots[0] || null;
  const alertByProp = new Map<string, OpsCanvasAlert[]>();
  for (const a of alerts) {
    if (!a.propertyId) continue;
    const list = alertByProp.get(a.propertyId) || [];
    list.push(a);
    alertByProp.set(a.propertyId, list);
  }

  if (properties.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[1.5rem] border border-dashed border-white/15 bg-[#0a1620] px-6 py-16 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_30%_40%,rgba(52,211,153,0.2),transparent_45%),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:auto,24px_24px,24px_24px]" />
        <p className="relative text-sm text-white/60">
          {radarT(loc, 'Coloca o primeiro espaço no mapa.', 'Poné el primer espacio en el mapa.', 'Place the first space on the map.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {openLot && (
        <RadarChainTrailBar locale={locale} stage={openLot.currentStage} code={openLot.code} />
      )}
      <div
        className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem] border border-white/10"
        style={{
          background:
            'radial-gradient(ellipse at 20% 10%, rgba(56,189,248,0.12), transparent 40%), radial-gradient(ellipse at 80% 90%, rgba(16,185,129,0.18), transparent 45%), #0a1620',
          backgroundImage:
            'radial-gradient(ellipse at 20% 10%, rgba(56,189,248,0.12), transparent 40%), radial-gradient(ellipse at 80% 90%, rgba(16,185,129,0.18), transparent 45%), linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: 'auto, auto, 26px 26px, 26px 26px',
        }}
      >
        {/* dashed custody path across canvas */}
        {openLot && properties.length >= 1 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d="M 12 70 C 30 55, 45 40, 55 45 S 78 55, 88 30"
              fill="none"
              stroke="rgba(52,211,153,0.55)"
              strokeWidth="0.7"
              strokeDasharray="2 1.5"
            />
            <circle cx="12" cy="70" r="1.4" fill="#34d399" />
            <circle cx="55" cy="45" r="1.4" fill="#34d399" />
            <circle cx="88" cy="30" r="1.4" fill="#34d399" />
          </svg>
        )}

        {properties.map((p, i) => {
          const slot = slotFor(i, properties.length);
          const active = p.id === selectedId;
          const pins = alertByProp.get(p.id) || [];
          const worst = pins.some((a) => a.severity === 'critical')
            ? 'critical'
            : pins.some((a) => a.severity === 'warning')
              ? 'warning'
              : null;
          const kind = spaceKindMeta(p.moduleId);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={`absolute overflow-hidden rounded-2xl border p-3 text-left shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-[2px] transition ${zoneTone(
                p.moduleId,
              )} ${active ? 'z-10 ring-2 ring-emerald-300/80 scale-[1.02]' : 'z-0 opacity-90 hover:opacity-100'}`}
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: `${slot.w}%`,
                height: `${slot.h}%`,
                transform: 'perspective(600px) rotateX(8deg)',
              }}
            >
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-white/70">
                    <ModuleGlyph moduleId={p.moduleId} />
                    <span className="truncate text-[10px] uppercase tracking-wide">{kind.unitLabelPlural[loc]}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-white">{p.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-white/50">
                    {[p.crop, p.clientName].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.unitCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/30 px-1.5 py-0.5 text-[10px] text-sky-100">
                      <Radio className="h-3 w-3 text-sky-300" />
                      {p.unitCount}
                      <span className="relative ml-0.5 flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/50" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-300" />
                      </span>
                    </span>
                  )}
                  {worst && (
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        worst === 'critical' ? 'bg-rose-400' : 'bg-amber-400'
                      } shadow-[0_0_10px_currentColor]`}
                    />
                  )}
                  <Link
                    href={hrefFor(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="ml-auto text-[10px] font-medium text-emerald-200/90 hover:text-emerald-100"
                  >
                    {radarT(loc, 'Abrir →', 'Abrir →', 'Open →')}
                  </Link>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
