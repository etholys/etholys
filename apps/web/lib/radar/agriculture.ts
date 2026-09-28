/**
 * Fachada RADAR — agricultura.
 * A pergunta do produto: o que fazer hoje na exploração.
 */
import { evaluateProtocolAlerts, type DerivedAlert } from '../nexus-sector-modules/alerts';
import { AGRICULTURE_MODULE } from '../nexus-sector-modules/agriculture';

export const RADAR_AGRICULTURE_ID = 'agriculture' as const;
export const MOISTURE_THRESHOLD = 25;
export const DEFAULT_IRRIGATION_MM = 10;

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

export type ParcelAction = 'irrigate' | 'hold_harvest' | 'scout' | 'await_signal' | 'ok';
export type FarmDecisionCode = 'open_farm' | ParcelAction;

const MOISTURE_METRIC = 'soil_moisture';
const IRRIGATION_METRIC = 'irrigation_mm';
const MS_DAY = 24 * 60 * 60 * 1000;

export function isAgricultureLineKind(v: string): v is AgricultureLineKind {
  return (AGRICULTURE_LINE_KINDS as readonly string[]).includes(v);
}

export function isAgricultureRuleKind(v: string): v is AgricultureRuleKind {
  return (AGRICULTURE_RULE_KINDS as readonly string[]).includes(v);
}

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
  moistureAt: string | null;
  moistureSource: string | null;
  irrigationMm: number | null;
  irrigationAt: string | null;
  lastLineAt: string | null;
  phiDaysLeft: number | null;
  phiProduct: string | null;
  harvestBlocked: boolean;
  nextAction: ParcelAction;
  alerts: AgricultureAlert[];
};

export type AgricultureDecision = {
  code: FarmDecisionCode;
  severity: 'critical' | 'warning' | 'ok';
  parcelId: string | null;
  parcelName: string | null;
  title: { es: string; pt: string; en: string };
  detail: { es: string; pt: string; en: string };
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
  source?: string;
};

function phiDaysFromPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const n = Number((payload as { phiDays?: unknown }).phiDays);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function productFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = String((payload as { product?: unknown }).product || '').trim();
  return p || null;
}

function latestReading(readings: ReadingIn[], unitId: string, metric: string): ReadingIn | null {
  let best: ReadingIn | null = null;
  for (const r of readings) {
    if (r.unitId !== unitId || r.metric !== metric) continue;
    if (!best || r.recordedAt.getTime() > best.recordedAt.getTime()) best = r;
  }
  return best;
}

function phiDaysLeft(lastInput: EntryIn | null, now: Date): number | null {
  if (!lastInput) return null;
  const wait = phiDaysFromPayload(lastInput.payloadJson) ?? 7;
  const elapsed = (now.getTime() - lastInput.occurredAt.getTime()) / MS_DAY;
  if (elapsed >= wait) return null;
  return Math.max(1, Math.ceil(wait - elapsed));
}

function parcelAction(input: {
  moisture: number | null;
  harvestBlocked: boolean;
  lastEntryAt: Date | null;
  now: Date;
}): ParcelAction {
  if (input.harvestBlocked) return 'hold_harvest';
  if (typeof input.moisture === 'number' && input.moisture < MOISTURE_THRESHOLD) return 'irrigate';
  if (input.moisture == null && !input.lastEntryAt) return 'await_signal';
  if (!input.lastEntryAt) return 'scout';
  const days = (input.now.getTime() - input.lastEntryAt.getTime()) / MS_DAY;
  if (days >= 14) return 'scout';
  return 'ok';
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

export function decideAgricultureNow(parcels: AgricultureParcelCard[]): AgricultureDecision {
  if (!parcels.length) {
    return {
      code: 'open_farm',
      severity: 'warning',
      parcelId: null,
      parcelName: null,
      title: {
        es: 'Hoy: abrir la finca',
        pt: 'Hoje: abrir a exploração',
        en: 'Today: open the farm',
      },
      detail: {
        es: 'Una parcela y el Radar empieza a leer humedad, riego y carencia.',
        pt: 'Uma parcela e o Radar começa a ler humidade, irrigação e carência.',
        en: 'One parcel and Radar starts reading moisture, irrigation and PHI.',
      },
    };
  }

  const hold = parcels.find((p) => p.nextAction === 'hold_harvest');
  if (hold) {
    const days = hold.phiDaysLeft ?? 0;
    const product = hold.phiProduct ? ` (${hold.phiProduct})` : '';
    return {
      code: 'hold_harvest',
      severity: 'critical',
      parcelId: hold.id,
      parcelName: hold.name,
      title: {
        es: `Hoy: no cosechar ${hold.name}`,
        pt: `Hoje: não colher ${hold.name}`,
        en: `Today: do not harvest ${hold.name}`,
      },
      detail: {
        es: `Carencia activa${product}: faltan ${days} día(s). Cosechar ahora pierde el lote.`,
        pt: `Carência ativa${product}: faltam ${days} dia(s). Colher agora perde o lote.`,
        en: `PHI active${product}: ${days} day(s) left. Harvesting now loses the lot.`,
      },
    };
  }

  const dry = [...parcels.filter((p) => p.nextAction === 'irrigate')].sort((a, b) => (a.moisture ?? 0) - (b.moisture ?? 0));
  if (dry[0]) {
    const p = dry[0];
    return {
      code: 'irrigate',
      severity: p.moisture != null && p.moisture < MOISTURE_THRESHOLD * 0.6 ? 'critical' : 'warning',
      parcelId: p.id,
      parcelName: p.name,
      title: {
        es: `Hoy: irrigar ${p.name}`,
        pt: `Hoje: irrigar ${p.name}`,
        en: `Today: irrigate ${p.name}`,
      },
      detail: {
        es: `Humedad ${p.moisture}% — umbral ${MOISTURE_THRESHOLD}%. El campo riega por criterio, no por turno.`,
        pt: `Humidade ${p.moisture}% — limiar ${MOISTURE_THRESHOLD}%. A exploração irriga por critério, não por turno.`,
        en: `Moisture ${p.moisture}% — threshold ${MOISTURE_THRESHOLD}%. Irrigate by criterion, not by turn.`,
      },
    };
  }

  const listening = parcels.find((p) => p.nextAction === 'await_signal');
  if (listening) {
    return {
      code: 'await_signal',
      severity: 'warning',
      parcelId: listening.id,
      parcelName: listening.name,
      title: {
        es: 'Hoy: el Radar está escuchando',
        pt: 'Hoje: o Radar está a ouvir',
        en: 'Today: Radar is listening',
      },
      detail: {
        es: 'Sin humedad todavía. El campo escribe humedad 18 o riego 12 mm por WhatsApp — el Hub decide irrigar o esperar.',
        pt: 'Sem humidade ainda. O campo escreve humidade 18 ou irrigação 12 mm no WhatsApp — o Hub decide irrigar ou esperar.',
        en: 'No moisture yet. The field texts moisture 18 or irrigation 12 mm on WhatsApp — the Hub decides irrigate or wait.',
      },
    };
  }

  const scout = parcels.find((p) => p.nextAction === 'scout');
  if (scout) {
    return {
      code: 'scout',
      severity: 'warning',
      parcelId: scout.id,
      parcelName: scout.name,
      title: {
        es: `Hoy: recorrer ${scout.name}`,
        pt: `Hoje: percorrer ${scout.name}`,
        en: `Today: walk ${scout.name}`,
      },
      detail: {
        es: 'Sin línea reciente. Una observación o un dato de WhatsApp cierra el hueco.',
        pt: 'Sem linha recente. Uma observação ou um dado de WhatsApp fecha o buraco.',
        en: 'No recent line. One observation or a WhatsApp reading closes the gap.',
      },
    };
  }

  const first = parcels[0];
  return {
    code: 'ok',
    severity: 'ok',
    parcelId: first.id,
    parcelName: first.name,
    title: {
      es: 'Hoy la finca está en criterio',
      pt: 'Hoje a exploração está em critério',
      en: 'Today the farm is on criterion',
    },
    detail: {
      es: 'Humedad, carencia y cuaderno en rango. El canal sigue escuchando.',
      pt: 'Humidade, carência e caderno em rango. O canal continua a ouvir.',
      en: 'Moisture, PHI and the book are in range. The channel is still listening.',
    },
  };
}

export function buildAgricultureBoard(input: {
  now: Date;
  units: UnitIn[];
  entries: EntryIn[];
  readings: ReadingIn[];
}): { parcels: AgricultureParcelCard[]; alerts: AgricultureAlert[]; decision: AgricultureDecision } {
  const parcelsIn = input.units.filter(isRadarParcel);
  if (!parcelsIn.length) {
    const empty: AgricultureAlert = {
      code: 'no_parcels',
      severity: 'warning',
      protocolId: 'planting_cycle',
      message: {
        es: 'Una parcela y el Radar empieza a leer.',
        pt: 'Uma parcela e o Radar começa a ler.',
        en: 'One parcel and Radar starts reading.',
      },
    };
    return { parcels: [], alerts: [empty], decision: decideAgricultureNow([]) };
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
    const moistureRow = latestReading(input.readings, unit.id, MOISTURE_METRIC);
    const irrigRow = latestReading(input.readings, unit.id, IRRIGATION_METRIC);
    const moisture = moistureRow ? moistureRow.value : null;
    const daysLeft = phiDaysLeft(lastInput, input.now);
    const derived = evaluateProtocolAlerts(AGRICULTURE_MODULE.protocols, {
      now: input.now,
      lastEntryAt: lastEntry?.occurredAt ?? null,
      lastInputAt: lastInput?.occurredAt ?? null,
      lastInputPhiDays: phiDaysFromPayload(lastInput?.payloadJson),
      lastMoisture: moisture,
      lastReadingByMetric: moisture == null ? {} : { soil_moisture: moisture },
    });
    const harvestBlocked = daysLeft != null && daysLeft > 0;
    return {
      id: unit.id,
      name: unit.name,
      areaHa: unit.areaHa,
      crop: unit.crop,
      moisture,
      moistureAt: moistureRow ? moistureRow.recordedAt.toISOString() : null,
      moistureSource: moistureRow?.source || null,
      irrigationMm: irrigRow ? irrigRow.value : null,
      irrigationAt: irrigRow ? irrigRow.recordedAt.toISOString() : null,
      lastLineAt: lastEntry ? lastEntry.occurredAt.toISOString() : null,
      phiDaysLeft: daysLeft,
      phiProduct: productFromPayload(lastInput?.payloadJson),
      harvestBlocked,
      nextAction: parcelAction({
        moisture,
        harvestBlocked,
        lastEntryAt: lastEntry?.occurredAt ?? null,
        now: input.now,
      }),
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

  return { parcels, alerts: [...farm.values()], decision: decideAgricultureNow(parcels) };
}
