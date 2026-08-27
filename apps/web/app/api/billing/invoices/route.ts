export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { isCompanyAdmin } from '@/lib/integrated-workspace';
import { markInvoicePaid } from '@/lib/billing/renew';

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
  const invoiceId = String(body.invoiceId || '').trim();
  if (!companyId || !invoiceId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  if (!(await isCompanyAdmin(tenant.userId, companyId))) {
    return NextResponse.json({ error: 'Apenas administrador da empresa.' }, { status: 403 });
  }

  const result = await markInvoicePaid(invoiceId, companyId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
