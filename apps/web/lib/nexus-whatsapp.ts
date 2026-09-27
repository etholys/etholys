import { createHash } from 'crypto';
import { isFieldEntryKind, type FieldEntryKindId } from './nexus-ops-token';

export const OPS_RULE_KINDS = ['irrigation', 'ventilation', 'whatsapp_alerts'] as const;
export type OpsRuleKind = (typeof OPS_RULE_KINDS)[number];

export function isOpsRuleKind(v: string): v is OpsRuleKind {
  return (OPS_RULE_KINDS as readonly string[]).includes(v);
}

export function normalizeWhatsappPhone(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

export type ParsedWhatsapp =
  | { type: 'ack' }
  | { type: 'reject' }
  | {
      type: 'entry';
      kind: FieldEntryKindId;
      note: string;
      metric?: string;
      value?: number;
      unit?: string;
      payload: Record<string, unknown>;
    };

const ACK = /^(sim+|s[ií]|ok+|okay|confirmo|confirmar|yes+|vale)$/i;
const REJECT = /^(n[aã]o+|no+|cancelar|cancela|negativo)$/i;

function firstNumber(text: string): number | null {
  const m = text.replace(',', '.').match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function parseInboundWhatsapp(text: string): ParsedWhatsapp {
  const raw = String(text || '').trim();
  const compact = raw.replace(/\s+/g, ' ');
  if (!compact) {
    return { type: 'entry', kind: 'note', note: '', payload: { note: '', source: 'whatsapp' } };
  }
  if (ACK.test(compact)) return { type: 'ack' };
  if (REJECT.test(compact)) return { type: 'reject' };

  const lower = compact.toLowerCase();
  const value = firstNumber(compact);

  const tryMetric = (
    kind: FieldEntryKindId,
    metric: string,
    unit: string,
    needles: string[]
  ): ParsedWhatsapp | null => {
    if (!needles.some((n) => lower.includes(n))) return null;
    return {
      type: 'entry',
      kind,
      note: compact,
      metric: value != null ? metric : undefined,
      value: value ?? undefined,
      unit: value != null ? unit : undefined,
      payload: { note: compact, source: 'whatsapp', ...(value != null ? { value, unit } : {}) },
    };
  };

  return (
    tryMetric('irrigation', 'irrigation_mm', 'mm', ['irrig', 'riego', 'água', 'agua', ' mm']) ||
    tryMetric('egg', 'egg_count', 'u', ['ovo', 'huevo', 'egg']) ||
    tryMetric('milking', 'milk_l', 'L', ['leite', 'leche', 'milk', 'litro']) ||
    tryMetric('health', 'mortality_pct', '%', ['morte', 'mortal', 'morreu', 'muerte']) ||
    tryMetric('observation', 'soil_moisture', '%', ['humidade', 'humedad', 'moisture', 'umidade']) ||
    tryMetric('harvest', 'harvest_kg', 'kg', ['colheita', 'cosecha', 'harvest']) ||
    tryMetric('feed', 'feed_kg', 'kg', ['ração', 'racion', 'feed', 'alimento']) ||
    {
      type: 'entry',
      kind: isFieldEntryKind('observation') ? 'observation' : 'note',
      note: compact,
      payload: { note: compact, source: 'whatsapp' },
    }
  );
}

export function alertFingerprint(alerts: Array<{ id?: string; title?: string; severity?: string }>): string {
  const raw = alerts
    .map((a) => `${a.id || ''}|${a.title || ''}|${a.severity || ''}`)
    .sort()
    .join(';');
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export function commandLabel(kind: string, locale: 'pt' | 'es' | 'en' = 'pt'): string {
  const map: Record<string, Record<'pt' | 'es' | 'en', string>> = {
    irrigation: { pt: 'irrigação', es: 'riego', en: 'irrigation' },
    ventilation: { pt: 'ventilação', es: 'ventilación', en: 'ventilation' },
  };
  return map[kind]?.[locale] || kind;
}

export function formatAlertMessage(
  alerts: Array<{ title?: string; summary?: string; severity?: string }>,
  locale: 'pt' | 'es' | 'en' = 'pt'
): string {
  const head =
    locale === 'es' ? 'Alertas NEXUS' : locale === 'en' ? 'NEXUS alerts' : 'Alertas NEXUS';
  const lines = alerts.slice(0, 6).map((a) => `• ${a.title || a.summary || a.severity || 'alerta'}`);
  return [head, ...lines].join('\n');
}

export function formatCommandRequest(kind: string, locale: 'pt' | 'es' | 'en' = 'pt'): string {
  const label = commandLabel(kind, locale);
  if (locale === 'es') return `Pedido de comando: encender ${label}. Responda SI para confirmar o NO para cancelar.`;
  if (locale === 'en') return `Command request: turn on ${label}. Reply YES to confirm or NO to cancel.`;
  return `Pedido de comando: ligar ${label}. Responda SIM para confirmar ou NÃO para cancelar.`;
}

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendWhatsappText(phoneE164: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_TOKEN || '';
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  if (!token || !phoneId) return { ok: false, error: 'whatsapp_not_configured' };
  const to = phoneE164.replace(/^\+/, '');
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: false, body: body.slice(0, 1400) },
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      return { ok: false, error: err.slice(0, 240) || `http_${r.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send_failed' };
  }
}

export function extractInboundMessages(payload: unknown): Array<{ phone: string; text: string; name?: string }> {
  if (!payload || typeof payload !== 'object') return [];
  const entries = (payload as { entry?: unknown[] }).entry;
  if (!Array.isArray(entries)) return [];
  const out: Array<{ phone: string; text: string; name?: string }> = [];
  for (const entry of entries) {
    const changes = entry && typeof entry === 'object' ? (entry as { changes?: unknown[] }).changes : null;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = change && typeof change === 'object' ? (change as { value?: Record<string, unknown> }).value : null;
      if (!value) continue;
      const contacts = Array.isArray(value.contacts) ? (value.contacts as Array<{ profile?: { name?: string } }>) : [];
      const name = contacts[0]?.profile?.name;
      const messages = Array.isArray(value.messages) ? (value.messages as Array<Record<string, unknown>>) : [];
      for (const msg of messages) {
        const from = String(msg.from || '').trim();
        const text =
          msg.text && typeof msg.text === 'object'
            ? String((msg.text as { body?: unknown }).body || '').trim()
            : '';
        if (!from || !text) continue;
        out.push({ phone: from, text, name });
      }
    }
  }
  return out;
}
