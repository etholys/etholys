export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getUserCompanyIds } from '@/lib/tenant';
import { isCompanyAdmin } from '@/lib/integrated-workspace';
import { isSystemAdmin } from '@/lib/platform-access';
import { isLikelyDbId } from '@/lib/utils';
import { buildExecutionPassport } from '@/lib/fundhub/build-execution-passport';

/** Agrega dados existentes — só leitura, sem alterar a BD. */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const session = await getServerSession(authOptions);
  const master = isSystemAdmin(session?.user?.email);
  const requested = req.nextUrl.searchParams.get('companyId')?.trim() ?? '';
  const companyId =
    isLikelyDbId(requested) && (master || tenant.companyIds.includes(requested))
      ? requested
      : tenant.companyIds[0] ?? '';

  if (!companyId) {
    return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });
  }

  const passport = await buildExecutionPassport(companyId);
  if (!passport) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
  }

  const canEdit = master || (await isCompanyAdmin(tenant.userId, companyId));
  return NextResponse.json({ companyId, canEdit, ...passport });
}
