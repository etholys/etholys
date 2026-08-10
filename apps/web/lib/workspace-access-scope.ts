import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  isPlatformFullAccess,
  isPrecommercialMode,
  homePathForSystems,
  type WorkspaceAccessMode,
} from '@/lib/platform-access';
import {
  getWorkspaceAccessForUser,
  isCompanyAdmin,
  parseSystemsJson,
  type WorkspaceSystemKey,
} from '@/lib/integrated-workspace';

export type WorkspaceJwtScope = {
  mode: WorkspaceAccessMode;
  allowedSystems: WorkspaceSystemKey[];
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
    return { mode: 'full', allowedSystems: [], homePath: '/hub', isSystemAdmin: true };
  }

  const memberships = await prisma.companyUser.findMany({
    where: { userId },
    select: { companyId: true, role: true },
  });

  if (memberships.some((m) => m.role === 'ADMIN')) {
    return { mode: 'full', allowedSystems: [], homePath: '/hub', isSystemAdmin: false };
  }

  // Sem CompanyUser: NUNCA dar Hub full (isso abriria a plataforma a project_guest).
  // FORGE course_only / Studio share_only / SIEP project_guest tratam-se nos respectivos scopes.
  if (memberships.length === 0) {
    const { getGuestProjectIds } = await import('@/lib/siep/permissions');
    const guestProjects = await getGuestProjectIds(userId);
    if (guestProjects.length > 0) {
      const home =
        guestProjects.length === 1
          ? `/siep/projects/${guestProjects[0]}`
          : '/siep/projects';
      return { mode: 'none', allowedSystems: [], homePath: home, isSystemAdmin: false };
    }
    if (!isPrecommercialMode()) {
      // Sem empresa e sem convite de projeto: sem acesso ao hub
      return { mode: 'none', allowedSystems: [], homePath: '/acesso', isSystemAdmin: false };
    }
    return { mode: 'none', allowedSystems: [], homePath: '/acesso', isSystemAdmin: false };
  }

  // Agregar grants de todas as empresas
  const systems = new Set<WorkspaceSystemKey>();
  let hasAnyGrant = false;
  let hasEnabledGrant = false;

  for (const m of memberships) {
    const access = await getWorkspaceAccessForUser(userId, m.companyId);
    if (access.ok) {
      hasAnyGrant = true;
      hasEnabledGrant = true;
      for (const s of access.systems) systems.add(s);
    } else if (access.reason !== 'no_record') {
      hasAnyGrant = true;
    } else {
      // no_record: em modo aberto = full; pré-comercial = sem acesso a essa empresa
      if (!isPrecommercialMode()) {
        return { mode: 'full', allowedSystems: [], homePath: '/hub', isSystemAdmin: false };
      }
    }
  }

  if (!isPrecommercialMode() && !hasAnyGrant) {
    return { mode: 'full', allowedSystems: [], homePath: '/hub', isSystemAdmin: false };
  }

  const list = [...systems];
  if (!hasEnabledGrant || list.length === 0) {
    return { mode: 'none', allowedSystems: [], homePath: '/acesso', isSystemAdmin: false };
  }

  return {
    mode: 'function_only',
    allowedSystems: list,
    homePath: homePathForSystems(list),
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
