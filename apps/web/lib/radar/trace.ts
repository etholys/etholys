/**
 * Traçabilidade RADAR — lote da colheita até a comercialização.
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

function publicPayload(payload: unknown): { note: string; destination?: string; buyer?: string; carrier?: string } {
  if (!payload || typeof payload !== 'object') return { note: '' };
  const row = payload as Record<string, unknown>;
  const out: { note: string; destination?: string; buyer?: string; carrier?: string } = {
    note: String(row.note || '').trim(),
  };
  if (row.destination) out.destination = String(row.destination).trim().slice(0, 200);
  if (row.buyer) out.buyer = String(row.buyer).trim().slice(0, 200);
  if (row.carrier) out.carrier = String(row.carrier).trim().slice(0, 200);
  return out;
}

/** Snapshot seguro para comprador/auditor — sem IDs internos. */
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
      };
    }),
  };
}

export function sharePath(publicToken: string): string {
  return `/radar/lote/${encodeURIComponent(publicToken)}`;
}
