export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { isLikelyDbId } from '@/lib/utils';
import { buildExecutionPassport } from '@/lib/fundhub/build-execution-passport';

/** Agrega dados existentes — só leitura, sem alterar a BD. */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const requested = req.nextUrl.searchParams.get('companyId')?.trim() ?? '';
  const companyId =
    isLikelyDbId(requested) && tenant.companyIds.includes(requested)
      ? requested
      : tenant.companyIds[0] ?? '';

  if (!companyId) {
    return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });
  }

  const passport = await buildExecutionPassport(companyId);
  if (!passport) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
  }

  return NextResponse.json({ companyId, ...passport });
}
