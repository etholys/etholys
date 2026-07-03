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
