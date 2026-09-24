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

/** F8 — inbox do operador: empresa actual + outras do mesmo tenant se tiver WL. */
export async function readOperatorInbox(companyIds: string[], primaryCompanyId: string) {
  const allowed = await companyHasWhitelabel(primaryCompanyId);
  const ids = allowed ? companyIds : [primaryCompanyId];
  const rows = [];
  for (const companyId of ids.slice(0, 12)) {
    const inbox = await readCompanyScanInbox(companyId);
    rows.push({
      companyId,
      pending: inbox.pending.length,
      later: inbox.later.length,
      items: inbox.pending.slice(0, 8),
    });
  }
  return { operator: allowed, companies: rows };
}
