import 'server-only';

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  WORKSPACE_SYSTEM_KEYS,
  type WorkspaceAccessState,
  type WorkspaceSystemKey,
  parseSystemsJson,
  normalizeSystemsInput,
  hasSystem,
} from '@/lib/integrated-workspace-shared';

export type { WorkspaceSystemKey, WorkspaceAccessState } from '@/lib/integrated-workspace-shared';
export {
  WORKSPACE_SYSTEM_KEYS,
  parseSystemsJson,
  normalizeSystemsInput,
  hasSystem,
} from '@/lib/integrated-workspace-shared';

export async function isCompanyAdmin(userId: string, companyId: string): Promise<boolean> {
  const row = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { role: true },
  });
  return row?.role === 'ADMIN';
}

export async function ensureWorkspaceAccessBootstrapForCompanyAdmin(
  userId: string,
  companyId: string
): Promise<void> {
  const anyGrant = await prisma.integratedWorkspaceAccess.count({ where: { companyId } });
  if (anyGrant > 0) return;
  if (!(await isCompanyAdmin(userId, companyId))) return;
  await prisma.integratedWorkspaceAccess.create({
    data: {
      companyId,
      userId,
      systems: [...WORKSPACE_SYSTEM_KEYS] as unknown as Prisma.InputJsonValue,
      enabled: true,
      grantedByUserId: userId,
    },
  });
}

export async function getWorkspaceAccessForUser(
  userId: string,
  companyId: string
): Promise<WorkspaceAccessState> {
  const row = await prisma.integratedWorkspaceAccess.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  if (!row) return { ok: false, reason: 'no_record' };
  if (!row.enabled) return { ok: false, reason: 'disabled' };
  const systems = parseSystemsJson(row.systems);
  if (systems.length === 0) return { ok: false, reason: 'no_systems' };
  return { ok: true, systems, recordId: row.id };
}
