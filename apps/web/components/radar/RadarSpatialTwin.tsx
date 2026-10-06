'use client';

import { Factory, Leaf, Package, Radio, Truck, User } from 'lucide-react';
import type { ParcelAction } from '@/lib/radar/agriculture';
import { MOISTURE_THRESHOLD } from '@/lib/radar/agriculture';
import type { RadarSiteLayoutDoc } from '@/lib/radar/site-layout';
import { radarLoc, radarT, type RadarLoc } from '@/lib/radar/i18n';

export type TwinParcel = {
  id: string;
  name: string;
  crop: string | null;
  areaHa: number | null;
  moisture: number | null;
  nextAction: ParcelAction;
  harvestBlocked: boolean;
  alerts: Array<{ severity: string }>;
};

export type TwinSensor = {
  id: string;
  name: string;
  unitId?: string | null;
  lastValue: number | null;
};

type Props = {
  locale: string;
  moduleId?: string | null;
  layout: RadarSiteLayoutDoc;
  parcels: TwinParcel[];
  sensors: TwinSensor[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  trailUnitIds?: string[];
  lotCode?: string | null;
  hero?: boolean;
};

function toneOf(p: TwinParcel): 'ok' | 'warn' | 'critical' {
  if (p.nextAction === 'irrigate' || p.nextAction === 'hold_harvest' || p.harvestBlocked) return 'critical';
  if (p.nextAction === 'scout' || p.nextAction === 'await_signal') return 'warn';
  if (p.moisture != null && p.moisture < MOISTURE_THRESHOLD) return 'warn';
  if (p.alerts.some((a) => a.severity === 'critical')) return 'critical';
  if (p.alerts.some((a) => a.severity === 'warning')) return 'warn';
  return 'ok';
}

const TONE = {
  ok: {
    top: 'from-emerald-500/60 to-emerald-900/75',
    side: 'bg-emerald-950/95',
    edge: 'border-emerald-300/45',
    glow: 'shadow-[0_18px_50px_rgba(16,185,129,0.4)]',
  },
  warn: {
    top: 'from-amber-400/60 to-amber-900/75',
    side: 'bg-amber-950/95',
    edge: 'border-amber-300/50',
    glow: 'shadow-[0_18px_50px_rgba(245,158,11,0.4)]',
  },
  critical: {
    top: 'from-rose-400/60 to-rose-950/80',
    side: 'bg-rose-950/95',
    edge: 'border-rose-300/55',
    glow: 'shadow-[0_18px_50px_rgba(244,63,94,0.45)]',
  },
} as const;

/** Approximate screen % for HUD labels above the isometric floor. */
function floorToScreen(x: number, y: number) {
  const nx = (x - 50) / 50;
  const ny = (y - 50) / 50;
  return {
    left: 50 + nx * 42 - ny * 28,
    top: 22 + nx * 18 + ny * 32,
  };
}

function SpaceScene({ moduleId, loc }: { moduleId?: string | null; loc: RadarLoc }) {
  if (moduleId === 'agroindustry') {
    return (
      <svg viewBox="0 0 120 70" className="h-full w-full" aria-hidden>
        <rect x="8" y="40" width="72" height="9" rx="2" fill="rgba(148,163,184,0.6)" />
        <rect x="12" y="28" width="13" height="11" rx="1" fill="rgba(167,243,208,0.65)" />
        <rect x="32" y="26" width="13" height="13" rx="1" fill="rgba(167,243,208,0.5)" />
        <rect x="52" y="28" width="13" height="11" rx="1" fill="rgba(167,243,208,0.65)" />
        <rect x="84" y="20" width="28" height="34" rx="3" fill="rgba(56,189,248,0.28)" stroke="rgba(125,211,252,0.55)" />
        <circle cx="98" cy="37" r="3.2" fill="#7dd3fc" />
        <text x="10" y="14" fill="rgba(255,255,255,0.5)" fontSize="8">
          {radarT(loc, 'empacotamento', 'empaque', 'packing')}
        </text>
      </svg>
    );
  }
  if (moduleId === 'livestock') {
    return (
      <svg viewBox="0 0 120 70" className="h-full w-full" aria-hidden>
        <rect x="10" y="18" width="42" height="38" rx="4" fill="rgba(251,191,36,0.22)" stroke="rgba(251,191,36,0.5)" />
        <rect x="60" y="18" width="42" height="38" rx="4" fill="rgba(251,191,36,0.16)" stroke="rgba(251,191,36,0.4)" />
        <ellipse cx="28" cy="40" rx="6" ry="4.5" fill="rgba(253,224,71,0.75)" />
        <ellipse cx="78" cy="42" rx="6" ry="4.5" fill="rgba(253,224,71,0.6)" />
        <ellipse cx="92" cy="34" rx="5" ry="3.5" fill="rgba(253,224,71,0.5)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 70" className="h-full w-full" aria-hidden>
      {[20, 32, 44, 56].map((y) => (
        <g key={y}>
          <path
            d={`M6 ${y} Q36 ${y - 5} 64 ${y} T114 ${y}`}
            stroke="rgba(52,211,153,0.65)"
            strokeWidth="2.2"
            fill="none"
          />
          <circle cx="22" cy={y - 1} r="1.8" fill="#86efac" />
          <circle cx="48" cy={y + 1} r="1.8" fill="#4ade80" />
          <circle cx="78" cy={y - 1} r="1.8" fill="#86efac" />
        </g>
      ))}
    </svg>
  );
}

function ModuleBadge({ moduleId }: { moduleId?: string | null }) {
  if (moduleId === 'agroindustry') return <Factory className="h-3 w-3" />;
  if (moduleId === 'livestock') return <Package className="h-3 w-3" />;
  return <Leaf className="h-3 w-3" />;
}

/**
 * Spatial digital twin (BlueIoT-leaning): isometric floor, extruded spaces
 * with scene objects, sensor beacons, custody trail. Click focuses a space.
 */
export function RadarSpatialTwin({
  locale,
  moduleId,
  layout,
  parcels,
  sensors,
  focusedId,
  onFocus,
  trailUnitIds,
  lotCode,
  hero = false,
}: Props) {
  const loc = radarLoc(locale);
  const byId = new Map(parcels.map((p) => [p.id, p]));

  const trailPts = (trailUnitIds?.length ? trailUnitIds : layout.spaces.map((s) => s.id).slice(0, 4))
    .map((id) => {
      const rect = layout.spaces.find((s) => s.id === id);
      if (!rect) return null;
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    })
    .filter(Boolean) as Array<{ x: number; y: number }>;

  const trailD =
    trailPts.length >= 2
      ? trailPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : null;

  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] border border-white/10 ${
        hero ? 'min-h-[300px] sm:min-h-[400px] md:min-h-[480px]' : 'min-h-[280px] sm:min-h-[360px]'
      }`}
      style={{
        background:
          'radial-gradient(ellipse at 25% 0%, rgba(56,189,248,0.16), transparent 42%), radial-gradient(ellipse at 85% 95%, rgba(16,185,129,0.2), transparent 48%), linear-gradient(165deg,#030b12 0%,#061410 45%,#020706 100%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(0,0,0,0.5)_100%)]" />

      <div className="absolute inset-0" style={{ perspective: '1200px' }}>
        <div
          className="absolute left-1/2 top-[10%] h-[82%] w-[94%] -translate-x-1/2"
          style={{
            transform: 'rotateX(60deg) rotateZ(-36deg)',
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            className="absolute inset-0 rounded-[2.25rem] border border-cyan-400/15"
            style={{
              background:
                'linear-gradient(135deg, rgba(6,78,59,0.5), rgba(8,47,73,0.42)), repeating-linear-gradient(0deg, rgba(167,243,208,0.08) 0 1px, transparent 1px 26px), repeating-linear-gradient(90deg, rgba(125,211,252,0.06) 0 1px, transparent 1px 26px)',
              boxShadow: '0 50px 100px rgba(0,0,0,0.6)',
            }}
          />

          {trailD && (
            <svg
              className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d={trailD}
                fill="none"
                stroke="rgba(52,211,153,0.9)"
                strokeWidth="1.2"
                strokeDasharray="3.5 2.2"
                strokeLinecap="round"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="1.6s" repeatCount="indefinite" />
              </path>
              {trailPts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="1.6" fill="#6ee7b7" />
              ))}
            </svg>
          )}

          {layout.spaces.map((rect) => {
            const parcel = byId.get(rect.id);
            if (!parcel) return null;
            const tone = toneOf(parcel);
            const t = TONE[tone];
            const focused = focusedId === parcel.id;
            const lift = focused ? 22 : 14;
            const spaceSensors = layout.sensors.filter((s) => s.spaceId === rect.id);

            return (
              <button
                key={rect.id}
                type="button"
                aria-pressed={focused}
                aria-label={parcel.name}
                onClick={() => onFocus(parcel.id)}
                className={`absolute z-[3] text-left transition-transform duration-300 ${
                  focused ? 'z-20 scale-[1.04]' : 'hover:scale-[1.02]'
                } ${t.glow}`}
                style={{
                  left: `${rect.x}%`,
                  top: `${rect.y}%`,
                  width: `${Math.max(rect.w, 12)}%`,
                  height: `${Math.max(rect.h, 12)}%`,
                  transformStyle: 'preserve-3d',
                }}
              >
                <span
                  className={`absolute inset-x-[6%] bottom-0 ${t.side} border ${t.edge}`}
                  style={{
                    height: `${lift}px`,
                    transform: `translateY(${lift * 0.4}px) rotateX(88deg)`,
                    transformOrigin: 'bottom center',
                  }}
                />
                <span
                  className={`absolute inset-0 overflow-hidden rounded-md border ${t.edge} bg-gradient-to-br ${t.top}`}
                  style={{ transform: `translateY(-${lift * 0.55}px) translateZ(${lift}px)` }}
                >
                  <span className="absolute inset-0 p-1 opacity-90">
                    <SpaceScene moduleId={moduleId} loc={loc} />
                  </span>
                  <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/45 px-1 py-0.5 text-white/75">
                    <ModuleBadge moduleId={moduleId} />
                    <User className="h-2.5 w-2.5 opacity-70" />
                  </span>
                  {tone !== 'ok' && (
                    <span
                      className={`absolute right-1 top-1 h-2.5 w-2.5 animate-pulse rounded-full ${
                        tone === 'critical' ? 'bg-rose-400' : 'bg-amber-400'
                      } shadow-[0_0_14px_currentColor]`}
                    />
                  )}
                </span>

                {spaceSensors.map((pin, idx) => {
                  const sens = sensors.find((s) => s.id === pin.id);
                  const live = sens?.lastValue;
                  return (
                    <span
                      key={pin.id}
                      title={live != null ? `${sens?.name || 'Sensor'}: ${live}` : sens?.name || 'Sensor'}
                      className="pointer-events-none absolute z-30 flex flex-col items-center"
                      style={{
                        left: `${18 + idx * 24}%`,
                        top: '4%',
                        transform: `translateY(-${lift + 18}px)`,
                      }}
                    >
                      <span className="relative flex h-5 w-5 items-center justify-center">
                        <span
                          className={`absolute inline-flex h-full w-full animate-ping rounded-full ${
                            live != null ? 'bg-sky-300/55' : 'bg-white/20'
                          }`}
                        />
                        <span
                          className={`relative flex h-3.5 w-3.5 items-center justify-center rounded-full shadow-[0_0_16px_rgba(125,211,252,0.95)] ${
                            live != null ? 'bg-sky-300 text-[#04110c]' : 'bg-white/35 text-white'
                          }`}
                        >
                          <Radio className="h-2 w-2" />
                        </span>
                      </span>
                      {live != null && (
                        <span className="mt-0.5 rounded bg-slate-950/85 px-1 text-[9px] font-semibold tabular-nums text-sky-100">
                          {Number.isInteger(live) ? live : live.toFixed(0)}
                        </span>
                      )}
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>

      {/* billboard labels */}
      <div className="pointer-events-none absolute inset-0 z-40">
        {layout.spaces.map((rect) => {
          const parcel = byId.get(rect.id);
          if (!parcel) return null;
          const screen = floorToScreen(rect.x + rect.w / 2, rect.y + rect.h * 0.15);
          const focused = focusedId === parcel.id;
          return (
            <div
              key={`hud-${rect.id}`}
              className={`absolute -translate-x-1/2 rounded-lg border px-2 py-1 shadow-lg backdrop-blur-md ${
                focused ? 'border-emerald-300/55 bg-emerald-950/85' : 'border-white/12 bg-black/60'
              }`}
              style={{
                left: `${Math.min(88, Math.max(12, screen.left))}%`,
                top: `${Math.min(78, Math.max(4, screen.top))}%`,
              }}
            >
              <p className="max-w-[10rem] truncate text-[11px] font-semibold text-white">{parcel.name}</p>
              <p className="truncate text-[10px] text-white/55">
                {[parcel.crop, parcel.moisture != null ? `${parcel.moisture}%` : null].filter(Boolean).join(' · ') ||
                  '—'}
              </p>
            </div>
          );
        })}
      </div>

      {lotCode && (
        <div className="absolute bottom-3 left-3 z-50 flex items-center gap-2 rounded-xl border border-emerald-400/35 bg-black/60 px-3 py-1.5 text-xs text-emerald-50 backdrop-blur">
          <Truck className="h-3.5 w-3.5 text-emerald-300" />
          <span>
            {radarT(loc, 'Custódia do lote', 'Custodia del lote', 'Lot custody')} · <strong>{lotCode}</strong>
          </span>
        </div>
      )}

      <p className="absolute bottom-3 right-3 z-50 text-[10px] uppercase tracking-[0.16em] text-white/30">
        {radarT(loc, 'Gémeo do sítio', 'Gemelo del sitio', 'Site twin')}
      </p>
    </div>
  );
}
