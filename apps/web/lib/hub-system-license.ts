import type { WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';

/** Mapeia id do cartão no Hub → chave de licença no workspace. */
const HUB_ID_TO_KEY: Record<string, WorkspaceSystemKey> = {
  atlas: 'ATLAS',
  siep: 'SIEP',
  fundhub: 'FUNDHUB',
  nexus: 'NEXUS',
  forge: 'FORGE',
  prism: 'PRISM',
};

export function hubSystemIdToLicenseKey(systemId: string): WorkspaceSystemKey | null {
  return HUB_ID_TO_KEY[systemId] ?? null;
}

/** Advisor e CARTA não passam por IntegratedWorkspaceAccess. */
export function isHubLicenseExempt(systemId: string): boolean {
  return systemId === 'advisor' || systemId === 'carta';
}

export type HubCardAccess = 'open' | 'locked' | 'coming_soon';

export const LICENSE_KEY_TO_HREF: Record<WorkspaceSystemKey, string> = {
  ATLAS: '/dashboard',
  SIEP: '/siep',
  FUNDHUB: '/hub/fundhub',
  NEXUS: '/hub/nexus',
  FORGE: '/hub/forge',
  PRISM: '/hub/prism',
};

export function resolveHubCardAccess(
  systemId: string,
  active: boolean,
  licensedSystems: WorkspaceSystemKey[] | null,
): HubCardAccess {
  if (!active) return 'coming_soon';
  if (isHubLicenseExempt(systemId)) return 'open';
  const key = hubSystemIdToLicenseKey(systemId);
  if (!key) return 'open';
  // Sem registo de licença → compatibilidade: mostrar tudo (comportamento anterior).
  if (licensedSystems === null) return 'open';
  return licensedSystems.includes(key) ? 'open' : 'locked';
}
