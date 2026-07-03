import 'server-only';

import { getUserCompanyIds } from '@/lib/tenant';
import { isLikelyDbId } from '@/lib/utils';

export async function resolveOpportunityCompanyId(requested?: string | null): Promise<{
  userId: string;
  companyId: string;
} | null> {
  const tenant = await getUserCompanyIds();
  if (!tenant) return null;

  const req = String(requested ?? '').trim();
  const companyId =
    isLikelyDbId(req) && tenant.companyIds.includes(req)
      ? req
      : tenant.companyIds[0] ?? '';

  if (!companyId) return null;
  return { userId: tenant.userId, companyId };
}
