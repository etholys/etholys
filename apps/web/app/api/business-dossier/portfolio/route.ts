export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadAuroraPortfolio } from '@/lib/business-dossier';
import { auroraPortfolioCounts } from '@/lib/aurora-week';

/** Carteira AURORA: negócios atendidos (não a inbox de casos AT). */
export async function GET() {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const businesses = await loadAuroraPortfolio(tenant.companyIds, tenant.userId);
  return NextResponse.json({
    businesses,
    counts: auroraPortfolioCounts(businesses),
  });
}
