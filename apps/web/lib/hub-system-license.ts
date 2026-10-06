import type { WorkspaceSystemKey, WorkspaceToolKey } from '@/lib/integrated-workspace-shared';
import { hubIdToToolKey } from '@/lib/integrated-workspace-shared';
import { companyHasHubTool, hubToolAddonSku } from '@/lib/hub-tool-addons';

/** Mapeamento id do cartão Hub → chave de licença (IntegratedWorkspaceAccess.systems). */
export const HUB_SYSTEM_ID_TO_LICENSE_KEY: Record<string, WorkspaceSystemKey> = {
  ATLAS: 'ATLAS',
  SIEP: 'SIEP',
  FUNDHUB: 'FUNDHUB',
  NEXUS: 'NEXUS',
  AURORA: 'NEXUS',
  POLARIS: 'NEXUS',
  RADAR: 'NEXUS',
  NIDO: 'NEXUS',
  RUMO: 'NEXUS',
  PULSO: 'NEXUS',
  FORGE: 'FORGE',
  PRISM: 'PRISM',
};

export const LICENSE_KEY_TO_HREF: Record<WorkspaceSystemKey, string> = {
  ATLAS: '/hub/atlas',
  SIEP: '/hub/siep',
  FUNDHUB: '/hub/fundhub',
  NEXUS: '/hub/aurora',
  FORGE: '/hub/forge',
  PRISM: '/hub/prism',
};

const EXTRA_NEXUS_HREFS = [
  '/hub/aurora',
  '/hub/polaris',
  '/hub/radar',
  '/hub/nido',
  '/hub/rumo',
  '/hub/pulso',
  '/hub/nexus',
];

export function hubSystemIdToLicenseKey(systemId: string): WorkspaceSystemKey | null {
  return HUB_SYSTEM_ID_TO_LICENSE_KEY[systemId.toUpperCase()] ?? null;
}

/** Advisor e Chorus — sem SKU próprio. Studio/Work exigem add-on quando há faturação. PRISM é sistema. */
export function isHubLicenseExempt(systemId: string): boolean {
  const id = systemId.toUpperCase();
  return id === 'ADVISOR' || id === 'MEET' || id === 'CHORUS';
}

export type HubCardAccess = 'open' | 'locked' | 'coming_soon';

export type HubCardAccessOptions = {
  canManage?: boolean;
  loading?: boolean;
  companyLicensedSystems?: WorkspaceSystemKey[] | null;
  /** Tools concedidas ao utilizador (function_only). Null = não filtrar por grant. */
  licensedTools?: WorkspaceToolKey[] | null;
  /** Tools disponíveis na empresa (add-ons). */
  companyTools?: WorkspaceToolKey[] | null;
  billingEnforced?: boolean;
  addOnCodes?: string[] | null;
};

export function resolveHubCardAccess(
  systemId: string,
  active: boolean,
  licensedSystems: WorkspaceSystemKey[] | null,
  opts?: HubCardAccessOptions,
): HubCardAccess {
  if (!active) return 'coming_soon';

  const toolKey = hubIdToToolKey(systemId);
  if (toolKey) {
    if (opts?.loading) return 'locked';
    if (
      !companyHasHubTool(systemId, {
        billingEnforced: opts?.billingEnforced,
        addOnCodes: opts?.addOnCodes,
      })
    ) {
      return 'locked';
    }
    if (opts?.canManage) {
      if (opts.companyTools && !opts.companyTools.includes(toolKey)) return 'locked';
      return 'open';
    }
    // Sem lista de tools no cliente → não abrir (evita bypass após rollout).
    if (opts?.licensedTools === null || opts?.licensedTools === undefined) return 'locked';
    return opts.licensedTools.includes(toolKey) ? 'open' : 'locked';
  }

  if (hubToolAddonSku(systemId)) {
    if (opts?.loading) return 'locked';
    return companyHasHubTool(systemId, {
      billingEnforced: opts?.billingEnforced,
      addOnCodes: opts?.addOnCodes,
    })
      ? 'open'
      : 'locked';
  }
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
    if (EXTRA_NEXUS_HREFS.some((p) => href === p || href.startsWith(`${p}/`))) {
      return catalog.includes('NEXUS');
    }
    for (const [key, keyHref] of Object.entries(LICENSE_KEY_TO_HREF)) {
      if (href === keyHref || href.startsWith(`${keyHref}/`)) {
        return catalog.includes(key as WorkspaceSystemKey);
      }
    }
    return true;
  }
  if (!licensedSystems || licensedSystems.length === 0) return false;
  if (EXTRA_NEXUS_HREFS.some((p) => href === p || href.startsWith(`${p}/`))) {
    return licensedSystems.includes('NEXUS');
  }
  for (const [key, keyHref] of Object.entries(LICENSE_KEY_TO_HREF)) {
    if (href === keyHref || href.startsWith(`${keyHref}/`)) {
      return licensedSystems.includes(key as WorkspaceSystemKey);
    }
  }
  return true;
}
