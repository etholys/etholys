import type { AvailabilityStatus, ScanFocus } from '@/lib/opportunity/scan-types';

export function normalizeAvailabilityStatus(raw: unknown): AvailabilityStatus | undefined {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'open_now' || s === 'open' || s === 'open now') return 'open_now';
  if (s === 'rolling') return 'rolling';
  if (s === 'seasonal') return 'seasonal';
  if (s === 'closed') return 'closed';
  if (s === 'reference') return 'reference';
  return undefined;
}

export function availabilityLabel(
  status: AvailabilityStatus | undefined,
  locale: string,
): string {
  const pt = locale === 'pt';
  const es = locale === 'es';
  switch (status) {
    case 'open_now':
      return pt ? 'Aberto agora' : es ? 'Abierto ahora' : 'Open now';
    case 'rolling':
      return pt ? 'Rolling' : es ? 'Rolling' : 'Rolling';
    case 'seasonal':
      return pt ? 'Janelas sazonais' : es ? 'Ventanas estacionales' : 'Seasonal windows';
    case 'closed':
      return pt ? 'Fechado' : es ? 'Cerrado' : 'Closed';
    case 'reference':
      return pt ? 'Referência' : es ? 'Referencia' : 'Reference';
    default:
      return pt ? 'Estado desconhecido' : es ? 'Estado desconocido' : 'Unknown';
  }
}

export function availabilityBadgeClass(status: AvailabilityStatus | undefined): string {
  switch (status) {
    case 'open_now':
      return 'bg-emerald-100 text-emerald-800';
    case 'rolling':
      return 'bg-sky-100 text-sky-800';
    case 'seasonal':
      return 'bg-amber-100 text-amber-900';
    case 'closed':
      return 'bg-gray-100 text-gray-600';
    case 'reference':
      return 'bg-violet-100 text-violet-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function fundStatusFromAvailability(status: AvailabilityStatus | undefined): string {
  switch (status) {
    case 'open_now':
    case 'rolling':
      return 'open';
    case 'seasonal':
      return 'seasonal';
    case 'closed':
      return 'closed';
    case 'reference':
      return 'reference';
    default:
      return 'open';
  }
}

export function isActionableNow(status: AvailabilityStatus | undefined, scanFocus: ScanFocus): boolean {
  if (scanFocus === 'reference') return true;
  return status === 'open_now' || status === 'rolling';
}

export function formatDateShort(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(
    locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'en-US',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );
}

const MONTH_TOKENS = [
  ['january', 'jan', 'enero', 'ene', 'janeiro'],
  ['february', 'feb', 'febrero', 'fev', 'fevereiro'],
  ['march', 'mar', 'marzo', 'março', 'marco'],
  ['april', 'apr', 'abril', 'abr'],
  ['may', 'mayo', 'mai', 'maio'],
  ['june', 'jun', 'junio', 'junho'],
  ['july', 'jul', 'julio', 'julho'],
  ['august', 'aug', 'agosto', 'ago'],
  ['september', 'sep', 'sept', 'septiembre', 'setembro', 'set'],
  ['october', 'oct', 'octubre', 'outubro', 'out', 'oct'],
  ['november', 'nov', 'noviembre', 'novembro'],
  ['december', 'dec', 'diciembre', 'dic', 'dezembro', 'dez'],
];

/** 1 Jan / 2026-01-01 — padrão clássico de prazo inventado pelo modelo. */
export function looksPlaceholderDate(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const s = raw.trim();
  if (/^\d{4}-01-01(?:[T\s].*)?$/.test(s)) return true;
  if (/^(?:0?1)[/.\\-](?:0?1)[/.\\-]20\d{2}$/.test(s)) return true;
  if (/^20\d{2}[/.\\-](?:0?1)[/.\\-](?:0?1)$/.test(s)) return true;
  if (/\b(?:0?1)\s+(?:de\s+)?(?:jan(?:eiro|uary)?|ene(?:ro)?)\s+(?:de\s+)?20\d{2}\b/i.test(s)) {
    return true;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCMonth() === 0 && d.getUTCDate() === 1;
}

export function dateAppearsInExcerpt(raw: string, excerpt: string): boolean {
  if (!raw?.trim() || !excerpt?.trim()) return false;
  const hay = excerpt.toLowerCase();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return hay.includes(raw.trim().toLowerCase().slice(0, 12));
  }
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const yyyy = String(year);
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  if (hay.includes(`${year}-${mm}-${dd}`)) return true;
  if (hay.includes(`${dd}/${mm}/${year}`) || hay.includes(`${dd}.${mm}.${year}`)) return true;
  if (hay.includes(`${mm}/${dd}/${year}`)) return true;
  for (const token of MONTH_TOKENS[month] ?? []) {
    if (hay.includes(yyyy) && (hay.includes(`${day} ${token}`) || hay.includes(`${token} ${day}`))) {
      return true;
    }
  }
  return false;
}

export function sanitizeIsoDate(
  raw: string | null | undefined,
  excerpt?: string,
): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  const text = excerpt?.trim() || '';
  if (text && dateAppearsInExcerpt(value, text)) return value;
  if (looksPlaceholderDate(value)) return null;
  if (text.length >= 400 && !dateAppearsInExcerpt(value, text)) return null;
  return value;
}

export function sanitizeCandidateDates<
  T extends {
    opensAt?: string | null;
    closesAt?: string | null;
    deadline?: string | null;
    applicationWindow?: string;
    sourceExcerpt?: string;
  },
>(c: T): T {
  const excerpt = c.sourceExcerpt;
  const opensAt = sanitizeIsoDate(c.opensAt, excerpt);
  const closesAt = sanitizeIsoDate(c.closesAt, excerpt);
  const deadline = sanitizeIsoDate(c.deadline, excerpt);
  let applicationWindow = c.applicationWindow;
  if (applicationWindow && looksPlaceholderDate(applicationWindow) && !dateAppearsInExcerpt(applicationWindow, excerpt || '')) {
    applicationWindow = undefined;
  }
  return { ...c, opensAt, closesAt, deadline, applicationWindow };
}
