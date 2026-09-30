export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { resolveAuroraViewerContext } from '@/lib/aurora-role';

/** Papel AURORA para a empresa ativa do Hub (incubadora vs negócio atendido). */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const activeCompanyId = String(req.nextUrl.searchParams.get('companyId') || '').trim();
  if (!activeCompanyId || !tenant.companyIds.includes(activeCompanyId)) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }
  const ctx = await resolveAuroraViewerContext(tenant.companyIds, activeCompanyId);
  return NextResponse.json({ ok: true, ...ctx });
}
