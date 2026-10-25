export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { buildRadarAssistantContext } from '@/lib/radar/assistant/context';
import { radarLoc } from '@/lib/radar/i18n';

async function authorize(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant };
}

/** GET /api/radar/assistant/context — snapshot for Assistente UI + LLM. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  const propertyId = String(url.searchParams.get('propertyId') || '').trim() || null;
  const clientId = String(url.searchParams.get('clientId') || '').trim() || null;
  const loc = radarLoc(url.searchParams.get('locale'));
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const context = await buildRadarAssistantContext({
    companyId,
    propertyId,
    clientId,
    locale: loc,
  });
  return NextResponse.json({ ok: true, context });
}
