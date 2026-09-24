export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { readOperatorInbox } from '@/lib/fundhub/operator-inbox';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const payload = await readOperatorInbox(tenant.companyIds, ctx.companyId);
  return NextResponse.json(payload);
}
