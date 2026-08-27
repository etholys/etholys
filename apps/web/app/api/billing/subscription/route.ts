export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { isCompanyAdmin } from '@/lib/integrated-workspace';
import {
  effectiveCompanyCatalog,
  getCompanyEntitlements,
} from '@/lib/billing/company-entitlements';

/** Estado de subscrição / licenças da empresa (admin). Preparado para Stripe. */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const companyId = req.nextUrl.searchParams.get('companyId')?.trim() || '';
  if (!companyId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });
  }

  if (!(await isCompanyAdmin(tenant.userId, companyId))) {
    return NextResponse.json({ error: 'Apenas administrador da empresa.' }, { status: 403 });
  }

  const ent = await getCompanyEntitlements(companyId);
  const catalog = effectiveCompanyCatalog(ent);

  return NextResponse.json({
    companyId,
    billingEnforced: ent.billingEnforced,
    subscriptionStatus: ent.subscriptionStatus,
    planCode: ent.planCode,
    maxSeats: ent.maxSeats,
    licensedSystems: ent.licensedSystems ?? catalog,
    catalog,
    paymentReady: true,
    stripeConnected: false,
  });
}
