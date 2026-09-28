export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { hydrateDossierFromNexus, loadDossier } from '@/lib/business-dossier';
import { ETHOLYS_PRODUCTS } from '@/lib/etholys-products';

/** API interna: RADAR lê o vínculo com AURORA ou POLARIS sem misturar os produtos na UI. */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const companyId = String(new URL(req.url).searchParams.get('companyId') || '').trim();
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }
  await hydrateDossierFromNexus(companyId, tenant.userId);
  const data = await loadDossier(companyId);
  const moduleId = data.dossier?.pulsoModule || null;
  const q = encodeURIComponent(companyId);
  return NextResponse.json({
    companyId,
    radarModule: moduleId,
    pulsoModule: moduleId,
    hasPortrait: Boolean(data.dossier?.portraitText),
    openBets: data.bets.filter((b) => b.status === 'accepted' || b.status === 'active').length,
    links: {
      aurora: `${ETHOLYS_PRODUCTS.aurora.href}?company=${q}`,
      polaris: `${ETHOLYS_PRODUCTS.polaris.href}?company=${q}`,
      radar: `${ETHOLYS_PRODUCTS.radar.href}?company=${q}`,
      nido: `${ETHOLYS_PRODUCTS.aurora.href}?company=${q}`,
      rumo: `${ETHOLYS_PRODUCTS.polaris.href}?company=${q}`,
      pulso: `${ETHOLYS_PRODUCTS.radar.href}?company=${q}`,
    },
  });
}
