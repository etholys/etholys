export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadAuroraPortfolio } from '@/lib/business-dossier';

/** Carteira AURORA: negócios atendidos (não a inbox de casos AT). */
export async function GET() {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const businesses = await loadAuroraPortfolio(tenant.companyIds);
  const needsAttention = businesses.filter((b) => b.stage !== 'steady').length;
  return NextResponse.json({
    businesses,
    counts: {
      total: businesses.length,
      needsAttention,
      talk: businesses.filter((b) => b.stage === 'talk').length,
      rhythm: businesses.filter((b) => b.stage === 'rhythm').length,
    },
  });
}
