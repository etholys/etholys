import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  isPlatformFullAccess,
  homePathForSystems,
  homePathForTools,
  type WorkspaceAccessMode,
} from '@/lib/platform-access';
import {
  getWorkspaceAccessForUser,
  isCompanyAdmin,
  parseSystemsJson,
  type WorkspaceSystemKey,
  type WorkspaceToolKey,
} from '@/lib/integrated-workspace';
import { isCompanyMembershipExpired } from '@/lib/access/membership-access';

export type WorkspaceJwtScope = {
  mode: WorkspaceAccessMode;
  allowedSystems: WorkspaceSystemKey[];
  allowedTools: WorkspaceToolKey[];
  homePath: string;
  /** System admin Etholys (allowlist) — NÃO admin de empresa. */
  isSystemAdmin: boolean;
};

/**
 * Resolve se o utilizador tem acesso completo (hub) ou só funções.
 * Em pré-comercial: sem grant = none (excepto platform admin / company ADMIN).
 */
export async function resolveWorkspaceJwtScope(userId: string): Promise<WorkspaceJwtScope> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });

  const systemAdmin = isPlatformFullAccess({ email: user?.email, role: user?.role });

  if (systemAdmin) {
    return {
      mode: 'full',
      allowedSystems: [],
      allowedTools: [],
      homePath: '/hub',
      isSystemAdmin: true,
    };
  }

  const memberships = await prisma.companyUser.findMany({
    where: { userId },
    select: { companyId: true, role: true },
  });

  const activeMemberships = [];
  for (const m of memberships) {
    if (!(await isCompanyMembershipExpired(userId, m.companyId))) {
      activeMemberships.push(m);
    }
  }

  if (activeMemberships.some((m) => m.role === 'ADMIN')) {
    return {
      mode: 'full',
      allowedSystems: [],
      allowedTools: [],
      homePath: '/hub',
      isSystemAdmin: false,
    };
  }

  if (activeMemberships.length === 0) {
    const { getGuestProjectIds } = await import('@/lib/siep/permissions');
    const guestProjects = await getGuestProjectIds(userId);
    if (guestProjects.length > 0) {
      const home =
        guestProjects.length === 1
          ? `/siep/projects/${guestProjects[0]}`
          : '/siep/projects';
      return {
        mode: 'none',
        allowedSystems: [],
        allowedTools: [],
        homePath: home,
        isSystemAdmin: false,
      };
    }
    return {
      mode: 'none',
      allowedSystems: [],
      allowedTools: [],
      homePath: '/acesso',
      isSystemAdmin: false,
    };
  }

  const systems = new Set<WorkspaceSystemKey>();
  const tools = new Set<WorkspaceToolKey>();
  let hasEnabledGrant = false;

  for (const m of activeMemberships) {
    const access = await getWorkspaceAccessForUser(userId, m.companyId);
    if (access.ok) {
      hasEnabledGrant = true;
      for (const s of access.systems) systems.add(s);
      for (const t of access.tools) tools.add(t);
    }
  }

  const systemList = [...systems];
  const toolList = [...tools];
  if (!hasEnabledGrant || (systemList.length === 0 && toolList.length === 0)) {
    return {
      mode: 'none',
      allowedSystems: [],
      allowedTools: [],
      homePath: '/acesso',
      isSystemAdmin: false,
    };
  }

  const homePath =
    systemList.length > 0
      ? homePathForSystems(systemList)
      : homePathForTools(toolList);

  return {
    mode: 'function_only',
    allowedSystems: systemList,
    allowedTools: toolList,
    homePath,
    isSystemAdmin: false,
  };
}

export async function assertCanInviteToCompany(userId: string, companyId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });
  if (isPlatformFullAccess({ email: user?.email, role: user?.role })) return true;
  return isCompanyAdmin(userId, companyId);
}

export { parseSystemsJson };
