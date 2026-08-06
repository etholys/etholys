import 'server-only';

import { prisma } from '@/lib/prisma';
import { isCompanyAdmin } from '@/lib/integrated-workspace';
import {
  ALL_SIEP_PERMISSIONS,
  DEFAULT_FIELD_PERMISSIONS,
  DEFAULT_PM_PERMISSIONS,
  DEFAULT_PROJECT_GUEST_PERMISSIONS,
  parseSiepPermissions,
  type SiepPermissionKey,
} from '@/lib/siep/permissions-shared';

export type { SiepPermissionKey, SiepPermissionGroup } from '@/lib/siep/permissions-shared';
export {
  ALL_SIEP_PERMISSIONS,
  DEFAULT_FIELD_PERMISSIONS,
  DEFAULT_PM_PERMISSIONS,
  DEFAULT_PROJECT_GUEST_PERMISSIONS,
  getSiepPermissionGroups,
  hasSiepPermission,
  parseSiepPermissions,
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

export type ProjectAccess =
  | {
      ok: true;
      mode: 'company' | 'project_guest';
      companyId: string;
      permissions: Set<SiepPermissionKey>;
    }
  | { ok: false; reason: 'not_found' | 'forbidden' };

/** Acesso ao projeto: membro da empresa OU convidado só do projeto. */
export async function resolveProjectAccess(
  userId: string,
  projectId: string,
): Promise<ProjectAccess> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, companyId: true, isActive: true },
  });
  if (!project) return { ok: false, reason: 'not_found' };

  const companyUser = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId, companyId: project.companyId } },
    select: { id: true },
  });

  if (companyUser) {
    const permissions = await resolveSiepPermissions(userId, project.companyId);
    // Project-level override if present on ProjectMember
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { permissions: true, status: true },
    });
    if (membership?.status === 'active') {
      const override = parseSiepPermissions(membership.permissions);
      if (override.length > 0) {
        return {
          ok: true,
          mode: 'company',
          companyId: project.companyId,
          permissions: new Set(override),
        };
      }
    }
    return {
      ok: true,
      mode: 'company',
      companyId: project.companyId,
      permissions,
    };
  }

  const guest = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId,
      accessMode: 'project_guest',
      status: { in: ['active', 'invited'] },
    },
    select: { permissions: true, status: true },
  });

  if (!guest) return { ok: false, reason: 'forbidden' };

  const custom = parseSiepPermissions(guest.permissions);
  return {
    ok: true,
    mode: 'project_guest',
    companyId: project.companyId,
    permissions: new Set(custom.length ? custom : DEFAULT_PROJECT_GUEST_PERMISSIONS),
  };
}

export async function getGuestProjectIds(userId: string): Promise<string[]> {
  const rows = await prisma.projectMember.findMany({
    where: {
      userId,
      accessMode: 'project_guest',
      status: { in: ['active', 'invited'] },
    },
    select: { projectId: true },
  });
  return rows.map((r) => r.projectId);
}

export async function getGuestCompanyIds(userId: string): Promise<string[]> {
  const rows = await prisma.projectMember.findMany({
    where: {
      userId,
      accessMode: 'project_guest',
      status: { in: ['active', 'invited'] },
    },
    select: { project: { select: { companyId: true } } },
  });
  return [...new Set(rows.map((r) => r.project.companyId))];
}
