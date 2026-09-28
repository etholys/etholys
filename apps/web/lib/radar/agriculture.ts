/**
 * Fachada RADAR — agricultura.
 * Protocolos e limiares vêm do módulo setorial; a UI não mostra dossiê.
 */
import { evaluateProtocolAlerts, type DerivedAlert } from '../nexus-sector-modules/alerts';
import { AGRICULTURE_MODULE } from '../nexus-sector-modules/agriculture';

export const RADAR_AGRICULTURE_ID = 'agriculture' as const;

export const AGRICULTURE_LINE_KINDS = [
  'planting',
  'irrigation',
  'input',
  'pest',
  'harvest',
  'observation',
] as const;

export type AgricultureLineKind = (typeof AGRICULTURE_LINE_KINDS)[number];

export const AGRICULTURE_RULE_KINDS = ['irrigation', 'whatsapp_alerts'] as const;
export type AgricultureRuleKind = (typeof AGRICULTURE_RULE_KINDS)[number];

const MOISTURE_METRIC = 'soil_moisture';
const IRRIGATION_METRIC = 'irrigation_mm';

export function isAgricultureLineKind(v: string): v is AgricultureLineKind {
  return (AGRICULTURE_LINE_KINDS as readonly string[]).includes(v);
}

export function isAgricultureRuleKind(v: string): v is AgricultureRuleKind {
  return (AGRICULTURE_RULE_KINDS as readonly string[]).includes(v);
}

/** Parcela do RADAR. Horticultura partilha o mesmo caderno de campo. */
export function isRadarParcel(unit: { kind: string }): boolean {
  return unit.kind === 'parcel';
}

export type AgricultureAlert = {
  code: DerivedAlert['code'] | 'no_parcels';
  severity: 'warning' | 'critical';
  protocolId: string;
  message: { es: string; pt: string; en: string };
};

export type AgricultureParcelCard = {
  id: string;
  name: string;
  areaHa: number | null;
  crop: string | null;
  moisture: number | null;
  irrigationMm: number | null;
  lastLineAt: string | null;
  alerts: AgricultureAlert[];
};

type UnitIn = {
  id: string;
  name: string;
  areaHa: number | null;
  crop: string | null;
  kind: string;
};

type EntryIn = {
  unitId: string | null;
  kind: string;
  occurredAt: Date;
  payloadJson: unknown;
};

type ReadingIn = {
  unitId: string | null;
  metric: string;
  value: number;
  recordedAt: Date;
};

function phiDaysFromPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const n = Number((payload as { phiDays?: unknown }).phiDays);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function latestReading(readings: ReadingIn[], unitId: string, metric: string): number | null {
  let best: ReadingIn | null = null;
  for (const r of readings) {
    if (r.unitId !== unitId || r.metric !== metric) continue;
    if (!best || r.recordedAt.getTime() > best.recordedAt.getTime()) best = r;
  }
  return best ? best.value : null;
}

function dedupeAlerts(alerts: DerivedAlert[]): DerivedAlert[] {
  const rank = { critical: 2, warning: 1 };
  const map = new Map<string, DerivedAlert>();
  for (const alert of alerts) {
    const prev = map.get(alert.code);
    if (!prev || rank[alert.severity] > rank[prev.severity]) map.set(alert.code, alert);
  }
  return [...map.values()];
}

function toCardAlert(alert: DerivedAlert): AgricultureAlert {
  return {
    code: alert.code,
    severity: alert.severity,
    protocolId: alert.protocolId,
    message: alert.message,
  };
}

export function buildAgricultureBoard(input: {
  now: Date;
  units: UnitIn[];
  entries: EntryIn[];
  readings: ReadingIn[];
}): { parcels: AgricultureParcelCard[]; alerts: AgricultureAlert[] } {
  const parcelsIn = input.units.filter(isRadarParcel);
  if (!parcelsIn.length) {
    const empty: AgricultureAlert = {
      code: 'no_parcels',
      severity: 'warning',
      protocolId: 'planting_cycle',
      message: {
        es: 'Registra la primera parcela para abrir el cuaderno.',
        pt: 'Regista a primeira parcela para abrir o caderno.',
        en: 'Register the first parcel to open the field book.',
      },
    };
    return { parcels: [], alerts: [empty] };
  }

  const parcels: AgricultureParcelCard[] = parcelsIn.map((unit) => {
    const unitEntries = input.entries.filter((e) => e.unitId === unit.id);
    const lastEntry = unitEntries.reduce<EntryIn | null>((best, e) => {
      if (!best || e.occurredAt.getTime() > best.occurredAt.getTime()) return e;
      return best;
    }, null);
    const lastInput = unitEntries
      .filter((e) => e.kind === 'input')
      .reduce<EntryIn | null>((best, e) => {
        if (!best || e.occurredAt.getTime() > best.occurredAt.getTime()) return e;
        return best;
      }, null);
    const moisture = latestReading(input.readings, unit.id, MOISTURE_METRIC);
    const derived = evaluateProtocolAlerts(AGRICULTURE_MODULE.protocols, {
      now: input.now,
      lastEntryAt: lastEntry?.occurredAt ?? null,
      lastInputAt: lastInput?.occurredAt ?? null,
      lastInputPhiDays: phiDaysFromPayload(lastInput?.payloadJson),
      lastMoisture: moisture,
      lastReadingByMetric: moisture == null ? {} : { soil_moisture: moisture },
    });
    return {
      id: unit.id,
      name: unit.name,
      areaHa: unit.areaHa,
      crop: unit.crop,
      moisture,
      irrigationMm: latestReading(input.readings, unit.id, IRRIGATION_METRIC),
      lastLineAt: lastEntry ? lastEntry.occurredAt.toISOString() : null,
      alerts: dedupeAlerts(derived).map(toCardAlert),
    };
  });

  const farm = new Map<string, AgricultureAlert>();
  const rank = { critical: 2, warning: 1 };
  for (const parcel of parcels) {
    for (const alert of parcel.alerts) {
      const prev = farm.get(alert.code);
      if (!prev || rank[alert.severity] > rank[prev.severity]) farm.set(alert.code, alert);
    }
  }

  return { parcels, alerts: [...farm.values()] };
}
