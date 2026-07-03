export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { isLikelyDbId } from '@/lib/utils';
import { buildDemandBoard } from '@/lib/fundhub/demand-board';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const requested = req.nextUrl.searchParams.get('companyId')?.trim() ?? '';
  const companyId =
    isLikelyDbId(requested) && tenant.companyIds.includes(requested)
      ? requested
      : tenant.companyIds[0] ?? '';

  if (!companyId) return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });

  const board = await buildDemandBoard(companyId);
  return NextResponse.json({ companyId, ...board });
}
