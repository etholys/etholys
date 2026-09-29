export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadAuroraPortfolio } from '@/lib/business-dossier';
import { auroraPortfolioCounts } from '@/lib/aurora-week';
import { isCompanyAdmin } from '@/lib/integrated-workspace';

/**
 * Carteira AURORA: negócios atendidos pela incubadora (operadora) ativa.
 * Técnicos vêem só os seus + sem técnico; admins vêem a carteira completa.
 */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const operatorCompanyId = String(req.nextUrl.searchParams.get('operatorCompanyId') || '').trim();
  const technicianUserId = String(req.nextUrl.searchParams.get('technicianUserId') || '').trim();
  const scopeParam = String(req.nextUrl.searchParams.get('scope') || '').trim();

  if (operatorCompanyId && !tenant.companyIds.includes(operatorCompanyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const canManage = operatorCompanyId
    ? await isCompanyAdmin(tenant.userId, operatorCompanyId)
    : false;

  let scope: 'all' | 'assigned' | 'mine' = canManage ? 'all' : 'assigned';
  if (canManage && (scopeParam === 'mine' || scopeParam === 'assigned' || scopeParam === 'all')) {
    scope = scopeParam;
  } else if (!canManage && scopeParam === 'mine') {
    scope = 'mine';
  }

  const businesses = await loadAuroraPortfolio(tenant.companyIds, tenant.userId, {
    operatorCompanyId: operatorCompanyId || null,
    scope,
    technicianUserId: canManage && technicianUserId ? technicianUserId : null,
  });

  const technicians = [
    ...new Map(
      businesses
        .filter((b) => b.technicianUserId)
        .map((b) => [b.technicianUserId, { userId: b.technicianUserId, name: b.technicianName || b.technicianUserId }]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return NextResponse.json({
    businesses,
    counts: auroraPortfolioCounts(businesses),
    canManage,
    technicians,
    scope,
    operatorCompanyId: operatorCompanyId || null,
  });
}
