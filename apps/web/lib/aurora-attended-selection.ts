/**
 * Seleção interna AURORA: negócio atendido + contrato AT.
 * Camada 1 (Hub) = empresa incubadora via `activeCompanyId`.
 * Camada 2 (AURORA) = MIPYME/atendido — nunca confundir com o seletor global.
 */

export type AuroraAttendedRef = {
  companyId: string;
  engagementId: string;
  name?: string;
  engagementTitle?: string;
};

const KEY_PREFIX = 'aurora_attended:';

export function auroraAttendedStorageKey(operatorCompanyId: string): string {
  return `${KEY_PREFIX}${operatorCompanyId}`;
}

export function readAuroraAttendedSelection(operatorCompanyId: string): AuroraAttendedRef | null {
  if (typeof window === 'undefined' || !operatorCompanyId) return null;
  try {
    const raw = window.localStorage.getItem(auroraAttendedStorageKey(operatorCompanyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuroraAttendedRef>;
    const companyId = String(parsed.companyId || '').trim();
    const engagementId = String(parsed.engagementId || '').trim();
    if (!companyId || !engagementId) return null;
    return {
      companyId,
      engagementId,
      name: parsed.name ? String(parsed.name) : undefined,
      engagementTitle: parsed.engagementTitle ? String(parsed.engagementTitle) : undefined,
    };
  } catch {
    return null;
  }
}

export function writeAuroraAttendedSelection(
  operatorCompanyId: string,
  ref: AuroraAttendedRef | null,
): void {
  if (typeof window === 'undefined' || !operatorCompanyId) return;
  const key = auroraAttendedStorageKey(operatorCompanyId);
  if (!ref?.companyId || !ref.engagementId) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(
    key,
    JSON.stringify({
      companyId: ref.companyId,
      engagementId: ref.engagementId,
      name: ref.name || '',
      engagementTitle: ref.engagementTitle || '',
    }),
  );
}

export function auroraToolHref(
  path: '/hub/aurora/diagnostico' | '/hub/aurora/dossie',
  ref: AuroraAttendedRef | null | undefined,
): string {
  if (!ref?.companyId || !ref.engagementId) return '/hub/aurora';
  const q = new URLSearchParams({ company: ref.companyId, engagement: ref.engagementId });
  return `${path}?${q}`;
}

export function parseAuroraAttendedFromSearch(search: {
  get: (key: string) => string | null;
}): AuroraAttendedRef | null {
  const companyId = String(search.get('company') || '').trim();
  const engagementId = String(search.get('engagement') || '').trim();
  if (!companyId || !engagementId) return null;
  return { companyId, engagementId };
}
