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

  if (isPlatformFullAccess({ email: user?.email, role: user?.role })) {
    return { mode: 'full', allowedSystems: [], homePath: '/hub' };
  }

  const memberships = await prisma.companyUser.findMany({
    where: { userId },
    select: { companyId: true, role: true },
  });

  if (memberships.some((m) => m.role === 'ADMIN')) {
    return { mode: 'full', allowedSystems: [], homePath: '/hub' };
  }

  // FORGE course_only sem empresa — tratado no forge scope; aqui none se pré-comercial
  if (memberships.length === 0) {
    if (!isPrecommercialMode()) {
      return { mode: 'full', allowedSystems: [], homePath: '/hub' };
    }
    return { mode: 'none', allowedSystems: [], homePath: '/acesso' };
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
        return { mode: 'full', allowedSystems: [], homePath: '/hub' };
      }
    }
  }

  if (!isPrecommercialMode() && !hasAnyGrant) {
    return { mode: 'full', allowedSystems: [], homePath: '/hub' };
  }

  const list = [...systems];
  if (!hasEnabledGrant || list.length === 0) {
    return { mode: 'none', allowedSystems: [], homePath: '/acesso' };
  }

  return {
    mode: 'function_only',
    allowedSystems: list,
    homePath: homePathForSystems(list),
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
