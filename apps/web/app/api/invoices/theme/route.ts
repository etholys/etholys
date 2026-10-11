export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { RURAL_COMMERCE_INVOICE_THEME } from '@/lib/atlas/invoice-theme';
import { loadInvoiceTheme, saveInvoiceTheme } from '@/lib/atlas/invoice-theme-store';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const companyId = req.nextUrl.searchParams.get('companyId')?.trim() || '';
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Empresa inválida' }, { status: 403 });
    }
    const theme = await loadInvoiceTheme(companyId);
    return NextResponse.json({ theme });
  } catch (e) {
    console.error('[GET /api/invoices/theme]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const companyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Empresa inválida' }, { status: 403 });
    }
    const raw = body.presetId === 'rural-commerce' ? RURAL_COMMERCE_INVOICE_THEME : body.theme;
    const theme = await saveInvoiceTheme(companyId, raw);
    return NextResponse.json({ theme });
  } catch (e) {
    console.error('[PUT /api/invoices/theme]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
