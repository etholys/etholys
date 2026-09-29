/**
 * Traçabilidade RADAR — cadeia de custódia com check-in por etapa.
 */
import { randomBytes } from 'crypto';

export const TRACE_STAGES = ['harvest', 'transform', 'transport', 'sale'] as const;
export type TraceStage = (typeof TRACE_STAGES)[number];

export const TRACE_STAGE_LABEL = {
  harvest: { es: 'Cosecha', pt: 'Colheita', en: 'Harvest' },
  transform: { es: 'Transformación', pt: 'Transformação', en: 'Processing' },
  transport: { es: 'Transporte', pt: 'Transporte', en: 'Transport' },
  sale: { es: 'Comercialización', pt: 'Comercialização', en: 'Sale' },
} as const;

export function isTraceStage(v: string): v is TraceStage {
  return (TRACE_STAGES as readonly string[]).includes(v);
}

export function stageIndex(stage: TraceStage): number {
  return TRACE_STAGES.indexOf(stage);
}

/** Próxima etapa obrigatória — não se salta. */
export function nextStage(current: TraceStage): TraceStage | null {
  const i = stageIndex(current);
  if (i < 0 || i >= TRACE_STAGES.length - 1) return null;
  return TRACE_STAGES[i + 1];
}

/**
 * Avanço válido: mesma etapa (evento extra) ou a imediatamente seguinte.
 * Não permite saltar nem voltar atrás.
 */
export function canAdvanceStage(current: TraceStage, target: TraceStage): boolean {
  const from = stageIndex(current);
  const to = stageIndex(target);
  if (from < 0 || to < 0) return false;
  return to === from || to === from + 1;
}

export function generateLotCode(now = new Date()): string {
  const y = now.getUTCFullYear().toString().slice(-2);
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `L${y}${m}${d}-${suffix}`;
}

export function generatePublicToken(): string {
  return randomBytes(18).toString('base64url');
}

export type CheckInEvidence = {
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
  photoKey: string | null;
  checkedInAt: string | null;
};

export function clampTraceCoord(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: Math.round(a * 1e6) / 1e6, lng: Math.round(b * 1e6) / 1e6 };
}

export function parseCheckInEvidence(payload: unknown): CheckInEvidence {
  if (!payload || typeof payload !== 'object') {
    return { lat: null, lng: null, photoUrl: null, photoKey: null, checkedInAt: null };
  }
  const row = payload as Record<string, unknown>;
  const coords = clampTraceCoord(row.lat, row.lng);
  const photoUrl = typeof row.photoUrl === 'string' && row.photoUrl.startsWith('http') ? row.photoUrl.slice(0, 500) : null;
  const photoKey = typeof row.photoKey === 'string' ? row.photoKey.slice(0, 400) : null;
  const checkedInAt =
    typeof row.checkedInAt === 'string'
      ? row.checkedInAt
      : typeof row.occurredAt === 'string'
        ? row.occurredAt
        : null;
  return {
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    photoUrl,
    photoKey,
    checkedInAt,
  };
}

export function buildCheckInPayload(input: {
  note?: string;
  destination?: string;
  buyer?: string;
  carrier?: string;
  lat?: number | null;
  lng?: number | null;
  photoUrl?: string | null;
  photoKey?: string | null;
  checkedInAt?: Date;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const occurred = input.checkedInAt || new Date();
  const payload: Record<string, unknown> = {
    note: String(input.note || '').trim().slice(0, 2000),
    checkedInAt: occurred.toISOString(),
    checkIn: true,
  };
  if (input.destination) payload.destination = String(input.destination).trim().slice(0, 200);
  if (input.buyer) payload.buyer = String(input.buyer).trim().slice(0, 200);
  if (input.carrier) payload.carrier = String(input.carrier).trim().slice(0, 200);
  const coords = clampTraceCoord(input.lat, input.lng);
  if (coords) {
    payload.lat = coords.lat;
    payload.lng = coords.lng;
  }
  if (input.photoUrl) payload.photoUrl = String(input.photoUrl).slice(0, 500);
  if (input.photoKey) payload.photoKey = String(input.photoKey).slice(0, 400);
  if (input.extra) Object.assign(payload, input.extra);
  return payload;
}

export type TraceEventIn = {
  stage: string;
  occurredAt: Date | string;
  payloadJson: unknown;
  channel?: string;
};

export type TraceLotIn = {
  code: string;
  crop: string | null;
  qty: number | null;
  unitLabel: string | null;
  currentStage: string;
  status: string;
  createdAt: Date | string;
  events: TraceEventIn[];
};

function noteOf(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const row = payload as { note?: unknown; destination?: unknown; buyer?: unknown; carrier?: unknown };
  const note = String(row.note || '').trim();
  if (note) return note;
  if (row.destination) return String(row.destination);
  if (row.buyer) return String(row.buyer);
  if (row.carrier) return String(row.carrier);
  return '';
}

function publicPayload(payload: unknown): {
  note: string;
  destination?: string;
  buyer?: string;
  carrier?: string;
  lat: number | null;
  lng: number | null;
  photoUrl: string | null;
  checkedInAt: string | null;
} {
  const evidence = parseCheckInEvidence(payload);
  if (!payload || typeof payload !== 'object') {
    return { note: '', lat: null, lng: null, photoUrl: null, checkedInAt: null };
  }
  const row = payload as Record<string, unknown>;
  const out: {
    note: string;
    destination?: string;
    buyer?: string;
    carrier?: string;
    lat: number | null;
    lng: number | null;
    photoUrl: string | null;
    checkedInAt: string | null;
  } = {
    note: String(row.note || '').trim(),
    lat: evidence.lat,
    lng: evidence.lng,
    photoUrl: evidence.photoUrl,
    checkedInAt: evidence.checkedInAt,
  };
  if (row.destination) out.destination = String(row.destination).trim().slice(0, 200);
  if (row.buyer) out.buyer = String(row.buyer).trim().slice(0, 200);
  if (row.carrier) out.carrier = String(row.carrier).trim().slice(0, 200);
  return out;
}

/** Snapshot seguro para comprador/auditor — sem IDs internos; com evidência de check-in. */
export function publicLotSnapshot(lot: TraceLotIn) {
  const stage = isTraceStage(lot.currentStage) ? lot.currentStage : 'harvest';
  return {
    code: lot.code,
    crop: lot.crop,
    qty: lot.qty,
    unitLabel: lot.unitLabel || 'kg',
    status: lot.status,
    currentStage: stage,
    stageLabel: TRACE_STAGE_LABEL[stage],
    stages: TRACE_STAGES.map((s) => ({
      id: s,
      label: TRACE_STAGE_LABEL[s],
      done: stageIndex(s) <= stageIndex(stage),
      current: s === stage,
    })),
    openedAt: typeof lot.createdAt === 'string' ? lot.createdAt : lot.createdAt.toISOString(),
    timeline: lot.events.map((e) => {
      const st = isTraceStage(e.stage) ? e.stage : 'harvest';
      const payload = publicPayload(e.payloadJson);
      return {
        stage: st,
        stageLabel: TRACE_STAGE_LABEL[st],
        occurredAt: typeof e.occurredAt === 'string' ? e.occurredAt : e.occurredAt.toISOString(),
        channel: e.channel === 'whatsapp' ? 'whatsapp' : 'app',
        note: payload.note || noteOf(e.payloadJson),
        destination: payload.destination || null,
        buyer: payload.buyer || null,
        carrier: payload.carrier || null,
        lat: payload.lat,
        lng: payload.lng,
        photoUrl: payload.photoUrl,
        checkedInAt: payload.checkedInAt,
        hasGeo: payload.lat != null && payload.lng != null,
        hasPhoto: Boolean(payload.photoUrl),
      };
    }),
  };
}

export function sharePath(publicToken: string): string {
  return `/radar/lote/${encodeURIComponent(publicToken)}`;
}

export function qrImageUrl(absoluteShareUrl: string, size = 200): string {
  const data = encodeURIComponent(absoluteShareUrl);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`;
}
