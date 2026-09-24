import type { L3, SectorProtocol } from './types';

export type AlertInput = {
  now: Date;
  lastEntryAt?: Date | null;
  lastMoisture?: number | null;
  lastInputAt?: Date | null;
  lastInputPhiDays?: number | null;
  lastReadingByMetric?: Record<string, number>;
};

export type DerivedAlert = {
  code: 'phi_active' | 'withdrawal_active' | 'moisture_low' | 'metric_out' | 'stale_book';
  severity: 'warning' | 'critical';
  protocolId: string;
  message: L3;
};

const MS_DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_DAY;
}

function readingFor(input: AlertInput, metric: string): number | undefined {
  if (metric === 'soil_moisture' && typeof input.lastMoisture === 'number') return input.lastMoisture;
  const v = input.lastReadingByMetric?.[metric];
  return typeof v === 'number' ? v : undefined;
}

export function evaluateProtocolAlerts(protocols: SectorProtocol[], input: AlertInput): DerivedAlert[] {
  const now = input.now;
  const out: DerivedAlert[] = [];

  for (const proto of protocols) {
    for (const rule of proto.rules) {
      if (rule.type === 'phi' || rule.type === 'withdrawal') {
        const applied = input.lastInputAt;
        if (!applied) continue;
        const waitDays = input.lastInputPhiDays ?? rule.days;
        const elapsed = daysBetween(applied, now);
        if (elapsed < waitDays) {
          const left = Math.ceil(waitDays - elapsed);
          const isPhi = rule.type === 'phi';
          out.push({
            code: isPhi ? 'phi_active' : 'withdrawal_active',
            severity: 'critical',
            protocolId: proto.id,
            message: {
              es: isPhi
                ? `Carencia activa: faltan ${left} día(s) antes de cosechar (${proto.title.es}).`
                : `Retiro activo: faltan ${left} día(s) (${proto.title.es}).`,
              pt: isPhi
                ? `Carência ativa: faltam ${left} dia(s) antes de colher (${proto.title.pt}).`
                : `Retirada ativa: faltam ${left} dia(s) (${proto.title.pt}).`,
              en: isPhi
                ? `PHI active: ${left} day(s) before harvest (${proto.title.en}).`
                : `Withdrawal active: ${left} day(s) (${proto.title.en}).`,
            },
          });
        }
      }

      if (rule.type === 'moisture_threshold') {
        const value = readingFor(input, rule.metric);
        if (typeof value !== 'number') continue;
        if (value < rule.below) {
          out.push({
            code: 'moisture_low',
            severity: value < rule.below * 0.6 ? 'critical' : 'warning',
            protocolId: proto.id,
            message: {
              es: `Humedad ${value}% por debajo del umbral ${rule.below}%.`,
              pt: `Humidade ${value}% abaixo do limiar ${rule.below}%.`,
              en: `Moisture ${value}% is below the ${rule.below}% threshold.`,
            },
          });
        }
      }

      if (rule.type === 'metric_threshold') {
        const value = readingFor(input, rule.metric);
        if (typeof value !== 'number') continue;
        const below = rule.below;
        const above = rule.above;
        const low = typeof below === 'number' && value < below;
        const high = typeof above === 'number' && value > above;
        if (!low && !high) continue;
        out.push({
          code: 'metric_out',
          severity: 'critical',
          protocolId: proto.id,
          message: {
            es: high
              ? `${rule.metric} ${value} por encima de ${above} (${proto.title.es}).`
              : `${rule.metric} ${value} por debajo de ${below} (${proto.title.es}).`,
            pt: high
              ? `${rule.metric} ${value} acima de ${above} (${proto.title.pt}).`
              : `${rule.metric} ${value} abaixo de ${below} (${proto.title.pt}).`,
            en: high
              ? `${rule.metric} ${value} is above ${above} (${proto.title.en}).`
              : `${rule.metric} ${value} is below ${below} (${proto.title.en}).`,
          },
        });
      }

      if (rule.type === 'stale_book') {
        const last = input.lastEntryAt;
        if (!last) {
          out.push({
            code: 'stale_book',
            severity: 'warning',
            protocolId: proto.id,
            message: {
              es: `Cuaderno vacío — ${proto.title.es} pide registro cada ${rule.days} días.`,
              pt: `Caderno vazio — ${proto.title.pt} pede registo a cada ${rule.days} dias.`,
              en: `Empty book — ${proto.title.en} asks for a record every ${rule.days} days.`,
            },
          });
          continue;
        }
        const elapsed = daysBetween(last, now);
        if (elapsed >= rule.days) {
          out.push({
            code: 'stale_book',
            severity: elapsed >= rule.days * 2 ? 'critical' : 'warning',
            protocolId: proto.id,
            message: {
              es: `Sin línea hace ${Math.floor(elapsed)} días (límite ${rule.days}).`,
              pt: `Sem linha há ${Math.floor(elapsed)} dias (limite ${rule.days}).`,
              en: `No line for ${Math.floor(elapsed)} days (limit ${rule.days}).`,
            },
          });
        }
      }
    }
  }

  return out;
}
