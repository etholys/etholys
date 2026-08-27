import type { WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';

/** Mapeamento id do cartão Hub → chave de licença (IntegratedWorkspaceAccess.systems). */
export const HUB_SYSTEM_ID_TO_LICENSE_KEY: Record<string, WorkspaceSystemKey> = {
  ATLAS: 'ATLAS',
  SIEP: 'SIEP',
  FUNDHUB: 'FUNDHUB',
  NEXUS: 'NEXUS',
  FORGE: 'FORGE',
  PRISM: 'PRISM',
};

export const LICENSE_KEY_TO_HREF: Record<WorkspaceSystemKey, string> = {
  ATLAS: '/hub/atlas',
  SIEP: '/hub/siep',
  FUNDHUB: '/hub/fundhub',
  NEXUS: '/hub/nexus',
  FORGE: '/hub/forge',
  PRISM: '/hub/prism',
};

export function hubSystemIdToLicenseKey(systemId: string): WorkspaceSystemKey | null {
  return HUB_SYSTEM_ID_TO_LICENSE_KEY[systemId.toUpperCase()] ?? null;
}

/** Advisor, Studio, Meet, Work — não passam por grant por sistema. */
export function isHubLicenseExempt(systemId: string): boolean {
  const id = systemId.toUpperCase();
  return id === 'ADVISOR' || id === 'STUDIO' || id === 'MEET' || id === 'WORK';
}

export type HubCardAccess = 'open' | 'locked' | 'coming_soon';

export type HubCardAccessOptions = {
  canManage?: boolean;
  loading?: boolean;
  companyLicensedSystems?: WorkspaceSystemKey[] | null;
};

export function resolveHubCardAccess(
  systemId: string,
  active: boolean,
  licensedSystems: WorkspaceSystemKey[] | null,
  opts?: HubCardAccessOptions,
): HubCardAccess {
  if (!active) return 'coming_soon';
  if (isHubLicenseExempt(systemId)) return 'open';

  const key = hubSystemIdToLicenseKey(systemId);
  if (!key) return 'open';

  if (opts?.loading) return 'locked';

  if (opts?.canManage) {
    const catalog = opts.companyLicensedSystems;
    if (catalog === null || catalog === undefined) return 'open';
    return catalog.includes(key) ? 'open' : 'locked';
  }

  if (licensedSystems === null) return 'locked';
  if (licensedSystems.length === 0) return 'locked';
  return licensedSystems.includes(key) ? 'open' : 'locked';
}

export function userHasLicenseForHref(
  href: string,
  licensedSystems: WorkspaceSystemKey[] | null,
  opts?: HubCardAccessOptions,
): boolean {
  if (opts?.loading) return false;
  if (opts?.canManage) {
    const catalog = opts.companyLicensedSystems;
    if (catalog === null || catalog === undefined) return true;
    for (const [key, keyHref] of Object.entries(LICENSE_KEY_TO_HREF)) {
      if (href === keyHref || href.startsWith(`${keyHref}/`)) {
        return catalog.includes(key as WorkspaceSystemKey);
      }
    }
    return true;
  }
  if (!licensedSystems || licensedSystems.length === 0) return false;
  for (const [key, keyHref] of Object.entries(LICENSE_KEY_TO_HREF)) {
    if (href === keyHref || href.startsWith(`${keyHref}/`)) {
      return licensedSystems.includes(key as WorkspaceSystemKey);
    }
  }
  return true;
}
