import 'server-only';

import { prisma } from '@/lib/prisma';
import { readCompanyScanInbox } from '@/lib/opportunity/candidate-store';

export async function companyHasWhitelabel(companyId: string): Promise<boolean> {
  const ent = await prisma.companyEntitlement.findUnique({
    where: { companyId_skuCode: { companyId, skuCode: 'license.whitelabel' } },
    select: { status: true },
  });
  return ent?.status === 'ACTIVE';
}

/** F8/R4 — inbox do operador: empresa actual + outras do mesmo tenant se tiver WL. */
export async function readOperatorInbox(companyIds: string[], primaryCompanyId: string) {
  const allowed = await companyHasWhitelabel(primaryCompanyId);
  const ids = allowed ? companyIds : [primaryCompanyId];

  const companiesMeta = await prisma.company.findMany({
    where: { id: { in: ids.slice(0, 12) } },
    select: { id: true, name: true, shortName: true },
  });
  const nameById = new Map(
    companiesMeta.map((c) => [c.id, c.shortName?.trim() || c.name] as const),
  );

  const rows = [];
  for (const companyId of ids.slice(0, 12)) {
    const inbox = await readCompanyScanInbox(companyId);
    const catalogOpen = await prisma.fund.count({
      where: {
        companyId,
        isActive: true,
        pipelineStatus: { in: ['decide', 'prepare', 'submitted'] },
      },
    });
    const won = await prisma.fund.count({
      where: { companyId, isActive: true, pipelineStatus: 'won' },
    });
    rows.push({
      companyId,
      companyName: nameById.get(companyId) || companyId.slice(0, 8),
      primary: companyId === primaryCompanyId,
      pending: inbox.pending.length,
      later: inbox.later.length,
      inProgress: catalogOpen,
      won,
      items: inbox.pending.slice(0, 8).map((c) => ({
        tempId: c.tempId,
        name: c.name,
        institution: c.institution,
        closesAt: c.closesAt,
        availabilityStatus: c.availabilityStatus,
        runId: c.runId,
      })),
    });
  }
  return { operator: allowed, companies: rows };
}
