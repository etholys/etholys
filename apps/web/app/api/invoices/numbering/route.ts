export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { ensureInvoiceCatalog } from '@/lib/atlas/invoice-catalog';
import { allocateInvoiceNumbers, parseInvoiceNumbering } from '@/lib/atlas/invoice-numbering';
import { parseDateOnlyToUtc } from '@/lib/atlas/date-only';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const companyId = req.nextUrl.searchParams.get('companyId')?.trim() || '';
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Empresa inválida' }, { status: 403 });
    }
    const { numbering } = await ensureInvoiceCatalog(companyId);
    const existing = await prisma.invoice.findMany({
      where: { companyId },
      select: { number: true },
    });
    const when = parseDateOnlyToUtc(req.nextUrl.searchParams.get('date')) || new Date();
    const { numbers } = allocateInvoiceNumbers({
      cfg: numbering,
      existingNumbers: existing.map((i) => i.number),
      count: 1,
      when,
    });
    return NextResponse.json({ numbering, preview: numbers[0] });
  } catch (e) {
    console.error('[GET /api/invoices/numbering]', e);
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
    const { numbering: current } = await ensureInvoiceCatalog(companyId);
    const numbering = parseInvoiceNumbering(body.numbering, current);
    await prisma.company.update({
      where: { id: companyId },
      data: { invoiceNumberingJson: numbering },
    });
    return NextResponse.json({ numbering });
  } catch (e) {
    console.error('[PUT /api/invoices/numbering]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
