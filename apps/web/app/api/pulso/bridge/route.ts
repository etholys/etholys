export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { loadDossier } from '@/lib/business-dossier';
import { ETHOLYS_PRODUCTS } from '@/lib/etholys-products';

/** API interna: PULSO lê/escreve o vínculo com NIDO ou RUMO sem misturar os produtos na UI. */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const companyId = String(new URL(req.url).searchParams.get('companyId') || '').trim();
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }
  const data = await loadDossier(companyId);
  return NextResponse.json({
    companyId,
    pulsoModule: data.dossier?.pulsoModule || null,
    hasPortrait: Boolean(data.dossier?.portraitText),
    openBets: data.bets.filter((b) => b.status === 'accepted' || b.status === 'active').length,
    links: {
      nido: `${ETHOLYS_PRODUCTS.nido.href}?company=${encodeURIComponent(companyId)}`,
      rumo: `${ETHOLYS_PRODUCTS.rumo.href}?company=${encodeURIComponent(companyId)}`,
      pulso: `${ETHOLYS_PRODUCTS.pulso.href}?company=${encodeURIComponent(companyId)}`,
    },
  });
}
