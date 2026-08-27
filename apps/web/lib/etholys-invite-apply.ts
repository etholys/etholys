import 'server-only';

import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { EtholysInvitePayload } from '@/lib/etholys-invite';
import { parseSiepPermissions } from '@/lib/siep/permissions-shared';
import {
  clampSystemsToCompanyEntitlements,
  effectiveCompanyCatalog,
  getCompanyEntitlements,
} from '@/lib/billing/company-entitlements';
import { normalizeSystemsInput, type WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';

type ApplyOpts = {
  invitationId: string;
  userId: string;
  companyId: string;
  role: UserRole;
  inviteKind: string;
  jobTitle?: string | null;
  accessUntil?: Date | null;
  systems: string[];
  accessMode: string;
  projectId?: string | null;
  projectPermissions?: unknown;
  companySiepPermissions?: unknown;
};

/**
 * Aplica um convite aceite a um user já existente (ou recém-criado).
 */
export async function applyAcceptedInvitation(opts: ApplyOpts): Promise<void> {
  const isAlly = opts.inviteKind === 'ally' || opts.accessMode === 'project_guest';
  const ent = await getCompanyEntitlements(opts.companyId);
  const normalized = normalizeSystemsInput(opts.systems) as WorkspaceSystemKey[];
  const systemsClamped = clampSystemsToCompanyEntitlements(normalized, ent);

  if (isAlly && opts.projectId) {
    const perms = parseSiepPermissions(opts.projectPermissions);
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: opts.projectId, userId: opts.userId } },
      update: {
        role: 'aliado',
        accessMode: 'project_guest',
        status: 'active',
        permissions: perms.length ? perms : undefined,
      },
      create: {
        projectId: opts.projectId,
        userId: opts.userId,
        role: 'aliado',
        accessMode: 'project_guest',
        status: 'active',
        permissions: perms.length ? perms : undefined,
      },
    });

    const systems = systemsClamped.length ? systemsClamped : ['SIEP'];
    await prisma.integratedWorkspaceAccess.upsert({
      where: { companyId_userId: { companyId: opts.companyId, userId: opts.userId } },
      create: {
        companyId: opts.companyId,
        userId: opts.userId,
        systems: systems as unknown as Prisma.InputJsonValue,
        enabled: true,
      },
      update: {
        systems: systems as unknown as Prisma.InputJsonValue,
        enabled: true,
      },
    });
  } else {
    const companySiep = parseSiepPermissions(opts.companySiepPermissions);
    await prisma.companyUser.upsert({
      where: { userId_companyId: { userId: opts.userId, companyId: opts.companyId } },
      create: {
        userId: opts.userId,
        companyId: opts.companyId,
        role: opts.role,
        jobTitle: opts.jobTitle || null,
        inviteKind: opts.inviteKind || 'employee',
        accessUntil: opts.accessUntil || null,
        siepPermissions: companySiep.length ? companySiep : undefined,
      },
      update: {
        role: opts.role,
        jobTitle: opts.jobTitle || null,
        inviteKind: opts.inviteKind || 'employee',
        accessUntil: opts.accessUntil || null,
        ...(companySiep.length ? { siepPermissions: companySiep } : {}),
      },
    });

    if (systemsClamped.length > 0 || opts.role === 'ADMIN') {
      const grantSystems =
        opts.role === 'ADMIN' && systemsClamped.length === 0
          ? effectiveCompanyCatalog(ent)
          : systemsClamped;
      await prisma.integratedWorkspaceAccess.upsert({
        where: { companyId_userId: { companyId: opts.companyId, userId: opts.userId } },
        create: {
          companyId: opts.companyId,
          userId: opts.userId,
          systems: grantSystems as unknown as Prisma.InputJsonValue,
          enabled: opts.role === 'ADMIN' || grantSystems.length > 0,
        },
        update: {
          systems: grantSystems as unknown as Prisma.InputJsonValue,
          enabled: opts.role === 'ADMIN' || grantSystems.length > 0,
        },
      });
    }
  }

  await prisma.invitation.update({
    where: { id: opts.invitationId },
    data: { status: 'accepted', acceptedAt: new Date() },
  });
}

export function invitationRowToApplyOpts(
  invitation: {
    id: string;
    companyId: string;
    role: UserRole;
    inviteKind?: string | null;
    jobTitle?: string | null;
    accessUntil?: Date | null;
    systems?: unknown;
    accessMode?: string | null;
    projectId?: string | null;
    projectPermissions?: unknown;
    companySiepPermissions?: unknown;
  },
  userId: string,
  systems: string[],
): ApplyOpts {
  return {
    invitationId: invitation.id,
    userId,
    companyId: invitation.companyId,
    role: invitation.role,
    inviteKind: invitation.inviteKind || 'employee',
    jobTitle: invitation.jobTitle,
    accessUntil: invitation.accessUntil,
    systems,
    accessMode: invitation.accessMode || 'company',
    projectId: invitation.projectId,
    projectPermissions: invitation.projectPermissions,
    companySiepPermissions: invitation.companySiepPermissions,
  };
}

export type { EtholysInvitePayload };
