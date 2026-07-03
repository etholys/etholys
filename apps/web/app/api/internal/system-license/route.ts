export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { WORKSPACE_SYSTEM_KEYS, type WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';
import { getUserCompanyIds } from '@/lib/tenant';
import { checkSystemLicense, resolveCompanyForLicense } from '@/lib/system-license-guard';

const KEY_SET = new Set<string>(WORKSPACE_SYSTEM_KEYS);

/** Verificação interna (middleware) — só leitura, não altera a BD. */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const systemRaw = req.nextUrl.searchParams.get('system')?.trim().toUpperCase() ?? '';
  if (!KEY_SET.has(systemRaw)) {
    return NextResponse.json({ error: 'Sistema inválido' }, { status: 400 });
  }
  const system = systemRaw as WorkspaceSystemKey;

  const explicitCompany = req.nextUrl.searchParams.get('companyId');
  const companyId = resolveCompanyForLicense(tenant, req, explicitCompany);
  if (!companyId) {
    return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });
  }

  const check = await checkSystemLicense(tenant.userId, companyId, system);
  if (!check.allowed) {
    return NextResponse.json(
      {
        error: `Sem licença para ${system}.`,
        code: 'SYSTEM_LICENSE_FORBIDDEN',
        system,
        reason: check.reason,
        companyId,
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    system,
    companyId,
    enforced: check.enforced,
  });
}
