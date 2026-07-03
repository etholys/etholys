export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  resolveSiepPermissions,
  permissionsToApi,
  SIEP_PERMISSION_GROUPS,
} from '@/lib/siep/permissions';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId')?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const perms = await resolveSiepPermissions(tenant.userId, companyId);
    return NextResponse.json({
      ...permissionsToApi(perms),
      groups: SIEP_PERMISSION_GROUPS,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
