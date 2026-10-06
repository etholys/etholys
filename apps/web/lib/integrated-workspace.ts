import 'server-only';

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  WORKSPACE_SYSTEM_KEYS,
  WORKSPACE_TOOL_KEYS,
  type WorkspaceAccessState,
  type WorkspaceSystemKey,
  type WorkspaceToolKey,
  parseSystemsJson,
  parseToolsJson,
  normalizeSystemsInput,
  normalizeToolsInput,
  hasSystem,
  hasTool,
} from '@/lib/integrated-workspace-shared';
import { isCompanyMembershipExpired } from '@/lib/access/membership-access';
import {
  effectiveCompanyCatalog,
  getCompanyEntitlements,
} from '@/lib/billing/company-entitlements';
import { companyHasHubTool } from '@/lib/hub-tool-addons';

export type { WorkspaceSystemKey, WorkspaceToolKey, WorkspaceAccessState } from '@/lib/integrated-workspace-shared';
export {
  WORKSPACE_SYSTEM_KEYS,
  WORKSPACE_TOOL_KEYS,
  parseSystemsJson,
  parseToolsJson,
  normalizeSystemsInput,
  normalizeToolsInput,
  hasSystem,
  hasTool,
} from '@/lib/integrated-workspace-shared';

/** Tools disponíveis para a empresa (add-ons Studio/Work quando faturação activa). */
export function companyAvailableTools(opts: {
  billingEnforced?: boolean;
  addOnCodes?: string[] | null;
}): WorkspaceToolKey[] {
  return WORKSPACE_TOOL_KEYS.filter((key) =>
    companyHasHubTool(key === 'CHORUS' ? 'meet' : key.toLowerCase(), {
      billingEnforced: opts.billingEnforced,
      addOnCodes: opts.addOnCodes,
    }),
  );
}

export function clampToolsToCompany(
  tools: WorkspaceToolKey[],
  opts: { billingEnforced?: boolean; addOnCodes?: string[] | null },
): WorkspaceToolKey[] {
  const allowed = new Set(companyAvailableTools(opts));
  return tools.filter((t) => allowed.has(t));
}

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
  const ent = await getCompanyEntitlements(companyId);
  const catalog = effectiveCompanyCatalog(ent);
  const tools = companyAvailableTools({
    billingEnforced: ent.billingEnforced,
    addOnCodes: ent.addOnCodes,
  });
  await prisma.integratedWorkspaceAccess.create({
    data: {
      companyId,
      userId,
      systems: catalog as unknown as Prisma.InputJsonValue,
      tools: tools as unknown as Prisma.InputJsonValue,
      enabled: true,
      grantedByUserId: userId,
    },
  });
}

export async function getWorkspaceAccessForUser(
  userId: string,
  companyId: string
): Promise<WorkspaceAccessState> {
  if (await isCompanyMembershipExpired(userId, companyId)) {
    return { ok: false, reason: 'disabled' };
  }
  const row = await prisma.integratedWorkspaceAccess.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  if (!row) return { ok: false, reason: 'no_record' };
  if (!row.enabled) return { ok: false, reason: 'disabled' };

  const ent = await getCompanyEntitlements(companyId);
  let systems = parseSystemsJson(row.systems);
  if (ent.billingEnforced && ent.licensedSystems) {
    const allowed = new Set(ent.licensedSystems);
    systems = systems.filter((s) => allowed.has(s));
  }

  let tools = parseToolsJson(row.tools);
  tools = clampToolsToCompany(tools, {
    billingEnforced: ent.billingEnforced,
    addOnCodes: ent.addOnCodes,
  });

  if (systems.length === 0 && tools.length === 0) {
    return { ok: false, reason: 'no_systems' };
  }

  return { ok: true, systems, tools, recordId: row.id };
}
