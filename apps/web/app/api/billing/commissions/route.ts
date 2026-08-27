export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { isCompanyAdmin } from '@/lib/integrated-workspace';
import { invoiceAccruedCommissions, scanFundhubSuccessFees, accrueCommission } from '@/lib/billing/commissions';

export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const companyId = String(body.companyId || '').trim();
  const action = String(body.action || '').trim();
  if (!companyId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });
  }
  if (!(await isCompanyAdmin(tenant.userId, companyId))) {
    return NextResponse.json({ error: 'Apenas administrador da empresa.' }, { status: 403 });
  }

  if (action === 'scan') {
    const result = await scanFundhubSuccessFees(companyId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'invoice') {
    const result = await invoiceAccruedCommissions(companyId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'accrue') {
    const skuCode = String(body.skuCode || '').trim();
    const sourceType = String(body.sourceType || 'MANUAL').trim();
    const sourceId = String(body.sourceId || '').trim();
    const baseAmountCents = Number(body.baseAmountCents);
    if (!skuCode || !sourceId || !Number.isFinite(baseAmountCents)) {
      return NextResponse.json({ error: 'skuCode, sourceId e baseAmountCents obrigatórios.' }, { status: 400 });
    }
    const result = await accrueCommission({
      companyId,
      skuCode,
      sourceType,
      sourceId,
      baseAmountCents: Math.round(baseAmountCents),
      currency: typeof body.currency === 'string' ? body.currency : 'USD',
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Acção inválida (scan | invoice | accrue).' }, { status: 400 });
}
