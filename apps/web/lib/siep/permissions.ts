import 'server-only';

import { prisma } from '@/lib/prisma';
import { isCompanyAdmin } from '@/lib/integrated-workspace';
import {
  ALL_SIEP_PERMISSIONS,
  DEFAULT_FIELD_PERMISSIONS,
  DEFAULT_PM_PERMISSIONS,
  parseSiepPermissions,
  type SiepPermissionKey,
} from '@/lib/siep/permissions-shared';

export type { SiepPermissionKey, SiepPermissionGroup } from '@/lib/siep/permissions-shared';
export {
  ALL_SIEP_PERMISSIONS,
  DEFAULT_FIELD_PERMISSIONS,
  DEFAULT_PM_PERMISSIONS,
  getSiepPermissionGroups,
  hasSiepPermission,
  permissionsToApi,
  SIEP_PERMISSION_GROUPS,
} from '@/lib/siep/permissions-shared';

export async function resolveSiepPermissions(
  userId: string,
  companyId: string,
): Promise<Set<SiepPermissionKey>> {
  if (await isCompanyAdmin(userId, companyId)) {
    return new Set(ALL_SIEP_PERMISSIONS);
  }

  const cu = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { role: true, siepPermissions: true },
  });

  if (!cu) return new Set();

  const custom = parseSiepPermissions(cu.siepPermissions);
  if (custom.length > 0) return new Set(custom);

  if (cu.role === 'ADMIN' || cu.role === 'PROJECT_MANAGER') {
    return new Set(DEFAULT_PM_PERMISSIONS);
  }

  return new Set(DEFAULT_FIELD_PERMISSIONS);
}
