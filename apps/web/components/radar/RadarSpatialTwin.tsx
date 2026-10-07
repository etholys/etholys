'use client';

import { MOISTURE_THRESHOLD, type ParcelAction } from '@/lib/radar/agriculture';
import { radarLoc, radarT } from '@/lib/radar/i18n';

export type TwinParcel = {
  id: string;
  name: string;
  crop: string | null;
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
  parcels: TwinParcel[];
  sensors: TwinSensor[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  hero?: boolean;
};

type Slot = { x: number; y: number; w: number; h: number };

function slotsFor(n: number): Slot[] {
  if (n <= 1) return [{ x: 22, y: 28, w: 56, h: 44 }];
  if (n === 2) {
    return [
      { x: 10, y: 30, w: 38, h: 42 },
      { x: 52, y: 30, w: 38, h: 42 },
    ];
  }
  if (n === 3) {
    return [
      { x: 8, y: 18, w: 40, h: 34 },
      { x: 52, y: 18, w: 40, h: 34 },
      { x: 28, y: 56, w: 44, h: 30 },
    ];
  }
  return [
    { x: 8, y: 16, w: 40, h: 32 },
    { x: 52, y: 16, w: 40, h: 32 },
    { x: 8, y: 52, w: 40, h: 32 },
    { x: 52, y: 52, w: 40, h: 32 },
  ];
}

function toneOf(p: TwinParcel): 'ok' | 'warn' | 'critical' {
  if (p.nextAction === 'irrigate' || p.nextAction === 'hold_harvest' || p.harvestBlocked) return 'critical';
  if (p.nextAction === 'scout' || p.nextAction === 'await_signal') return 'warn';
  if (p.moisture != null && p.moisture < MOISTURE_THRESHOLD) return 'warn';
  if (p.alerts.some((a) => a.severity === 'critical')) return 'critical';
  if (p.alerts.some((a) => a.severity === 'warning')) return 'warn';
  return 'ok';
}

const PIN = {
  ok: '#0284c7',
  warn: '#d97706',
  critical: '#e11d48',
} as const;

function ZoneProps({
  moduleId,
  x,
  y,
  w,
  h,
  i,
}: {
  moduleId?: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  i: number;
}) {
  const cx = x + w * 0.5;
  const cy = y + h * 0.55;
  if (moduleId === 'agroindustry') {
    return (
      <g opacity={0.9}>
        <rect x={x + 4} y={cy - 2} width={w - 8} height={3.2} rx={0.8} fill="#94a3b8" />
        <rect x={cx - 6} y={cy - 10} width={4} height={8} rx={0.6} fill="#38bdf8" />
        <rect x={x + 6} y={cy + 4} width={5} height={4} rx={0.5} fill="#64748b" />
        <rect x={x + 13} y={cy + 4} width={5} height={4} rx={0.5} fill="#64748b" />
      </g>
    );
  }
  if (moduleId === 'livestock') {
    return (
      <g opacity={0.9}>
        <rect
          x={x + 5}
          y={y + 10}
          width={w - 10}
          height={h - 18}
          rx={2}
          fill="#fde68a"
          fillOpacity={0.35}
          stroke="#fbbf24"
          strokeWidth={0.4}
        />
        <ellipse cx={cx - 6} cy={cy} rx={3.2} ry={2.2} fill="#fbbf24" />
        <ellipse cx={cx + 7} cy={cy + 2} rx={2.8} ry={2} fill="#f59e0b" />
      </g>
    );
  }
  const rows = [0, 1, 2].map((r) => y + 12 + r * (h * 0.18));
  return (
    <g opacity={0.92}>
      {rows.map((ry) => (
        <path
          key={ry}
          d={`M${x + 5} ${ry} Q${cx} ${ry - 1.8} ${x + w - 5} ${ry}`}
          stroke="#22c55e"
          strokeWidth={1.4}
          fill="none"
          opacity={0.75}
        />
      ))}
      <rect x={cx - 4 + (i % 2)} y={cy + 4} width={5} height={3.5} rx={0.5} fill="#86efac" />
      <rect x={cx + 3} y={cy + 5} width={4.5} height={3} rx={0.5} fill="#4ade80" />
    </g>
  );
}

function SensorBeacon({
  cx,
  cy,
  color,
  label,
}: {
  cx: number;
  cy: number;
  color: string;
  label: string;
}) {
  return (
    <g transform={`translate(${cx} ${cy})`} pointerEvents="none">
      <title>{label}</title>
      <circle r={9} fill="none" stroke={color} strokeWidth={0.55} opacity={0.22} />
      <circle r={6.2} fill="none" stroke={color} strokeWidth={0.65} opacity={0.4} />
      <circle r={3.6} fill="none" stroke={color} strokeWidth={0.75} opacity={0.65} />
      <rect x={-2.2} y={-2.2} width={4.4} height={4.4} rx={0.7} fill="#1e293b" stroke="#0f172a" strokeWidth={0.35} />
      <rect x={-1.2} y={-1.2} width={2.4} height={2.4} rx={0.35} fill={color} opacity={0.95} />
    </g>
  );
}

/** Isometric platform with rooms, props, and sensor rings (BlueIoT-style). */
export function RadarSpatialTwin({
  locale,
  moduleId,
  parcels,
  sensors,
  focusedId,
  onFocus,
  hero = false,
}: Props) {
  const loc = radarLoc(locale);
  const shown = parcels.slice(0, 4);
  const slots = slotsFor(Math.max(1, shown.length));
  const tall = hero
    ? 'min-h-[300px] sm:min-h-[400px] md:min-h-[460px]'
    : 'min-h-[280px] sm:min-h-[360px]';

  if (shown.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-white/10 bg-[#dbeafe]">
        <p className="text-sm text-slate-600">
          {radarT(loc, 'Ainda sem espacos na planta.', 'Aun sin espacios en la planta.', 'No spaces on the plant yet.')}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200/80 ${tall}`}
      style={{
        background: 'radial-gradient(ellipse at 50% 30%, #e0f2fe 0%, #bfdbfe 45%, #93c5fd 100%)',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={radarT(loc, 'Planta espacial', 'Planta espacial', 'Spatial plant')}
      >
        <ellipse cx={50} cy={92} rx={34} ry={4.5} fill="#1e3a5f" opacity={0.18} />

        <g transform="translate(50 52) scale(1 0.58) rotate(-28) translate(-50 -50)">
          <rect
            x={6}
            y={10}
            width={88}
            height={80}
            rx={6}
            fill="#f1f5f9"
            stroke="#cbd5e1"
            strokeWidth={0.8}
          />
          {Array.from({ length: 9 }).map((_, i) => (
            <line
              key={`v-${i}`}
              x1={14 + i * 9}
              y1={16}
              x2={14 + i * 9}
              y2={84}
              stroke="#94a3b8"
              strokeWidth={0.25}
              opacity={0.35}
            />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={`h-${i}`}
              x1={10}
              y1={18 + i * 9}
              x2={90}
              y2={18 + i * 9}
              stroke="#94a3b8"
              strokeWidth={0.25}
              opacity={0.35}
            />
          ))}

          {shown.map((parcel, i) => {
            const slot = slots[i] || slots[slots.length - 1];
            const focused = focusedId === parcel.id;
            const tone = toneOf(parcel);
            const pinColor = PIN[tone];
            const roomSensors = sensors.filter((s) => s.unitId === parcel.id);
            const fallback: TwinSensor = {
              id: `zone-${parcel.id}`,
              name: parcel.name,
              lastValue: parcel.moisture,
              unitId: parcel.id,
            };
            const beacon = roomSensors[0] || fallback;
            const shortName = parcel.name.length > 16 ? `${parcel.name.slice(0, 15)}...` : parcel.name;
            const beaconLabel =
              beacon.lastValue != null ? `${beacon.name}: ${beacon.lastValue}` : beacon.name;

            return (
              <g key={parcel.id}>
                <rect
                  x={slot.x}
                  y={slot.y}
                  width={slot.w}
                  height={slot.h}
                  rx={2.2}
                  fill={focused ? '#ffffff' : '#f8fafc'}
                  stroke={focused ? '#0284c7' : '#94a3b8'}
                  strokeWidth={focused ? 1.4 : 0.7}
                  className="cursor-pointer"
                  onClick={() => onFocus(parcel.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={parcel.name}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onFocus(parcel.id);
                  }}
                />
                <path
                  d={`M${slot.x} ${slot.y + 6} L${slot.x} ${slot.y} L${slot.x + slot.w} ${slot.y} L${slot.x + slot.w} ${slot.y + 6}`}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth={0.9}
                  opacity={0.9}
                  pointerEvents="none"
                />
                <ZoneProps moduleId={moduleId} x={slot.x} y={slot.y} w={slot.w} h={slot.h} i={i} />
                <text
                  x={slot.x + 2.5}
                  y={slot.y + 5.2}
                  fill="#0f172a"
                  fontSize={3.2}
                  fontWeight={600}
                  pointerEvents="none"
                >
                  {shortName}
                </text>
                <SensorBeacon
                  cx={slot.x + slot.w * 0.72}
                  cy={slot.y + slot.h * 0.38}
                  color={pinColor}
                  label={beaconLabel}
                />
                {roomSensors.slice(1, 3).map((s, si) => (
                  <SensorBeacon
                    key={s.id}
                    cx={slot.x + slot.w * (0.35 + si * 0.18)}
                    cy={slot.y + slot.h * 0.7}
                    color={pinColor}
                    label={s.lastValue != null ? `${s.name}: ${s.lastValue}` : s.name}
                  />
                ))}
              </g>
            );
          })}
        </g>
      </svg>

      {parcels.length > 4 ? (
        <p className="absolute bottom-2 right-3 text-[10px] font-medium text-slate-600/80">
          +{parcels.length - 4} {radarT(loc, 'na arvore', 'en el arbol', 'in the tree')}
        </p>
      ) : null}
    </div>
  );
}
