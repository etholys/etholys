export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { isCompanyAdmin } from '@/lib/integrated-workspace';
import { BILLING_CATALOG, pickI18n, quoteSku } from '@/lib/billing/catalog';
import { getCompanyEntitlements } from '@/lib/billing/company-entitlements';

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

  const locale = req.nextUrl.searchParams.get('locale')?.trim() || 'pt';
  const ent = await getCompanyEntitlements(companyId);
  const contracted = new Set([
    ...ent.addOnCodes,
    ...ent.commissionCodes,
    ...ent.licenseCodes,
    ...(ent.planCode ? [ent.planCode] : []),
    ...(ent.licensedSystems ?? []).map((s) => `sys.${s}`),
  ]);

  const items = BILLING_CATALOG.map((sku) => {
    const monthly = quoteSku(sku, 'MONTH', { licensedSystems: ent.licensedSystems ?? [] });
    const yearly = quoteSku(sku, 'YEAR', { licensedSystems: ent.licensedSystems ?? [] });
    return {
      code: sku.code,
      kind: sku.kind,
      name: pickI18n(sku.name, locale),
      blurb: pickI18n(sku.blurb, locale),
      systems: sku.systems,
      requiresSystems: sku.requiresSystems,
      interval: sku.interval,
      selfServe: sku.selfServe,
      commissionBps: sku.commissionBps,
      contracted: contracted.has(sku.code),
      priceMonthlyCents: 'error' in monthly ? null : monthly.priceCents,
      priceYearlyCents: 'error' in yearly ? null : yearly.priceCents,
      currency: sku.currency,
    };
  });

  return NextResponse.json({ companyId, items });
}
