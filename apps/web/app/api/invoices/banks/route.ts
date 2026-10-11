export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { ensureInvoiceCatalog } from '@/lib/atlas/invoice-catalog';

async function companyOk(companyId: string) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (!companyId || !tenant.companyIds.includes(companyId)) {
    return { error: NextResponse.json({ error: 'Empresa inválida' }, { status: 403 }) };
  }
  return { tenant };
}

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get('companyId')?.trim() || '';
    const gate = await companyOk(companyId);
    if (gate.error) return gate.error;
    await ensureInvoiceCatalog(companyId);
    const banks = await prisma.companyBankAccount.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({ banks });
  } catch (e) {
    console.error('[GET /api/invoices/banks]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const companyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';
    const gate = await companyOk(companyId);
    if (gate.error) return gate.error;
    const bankName = String(body.bankName || '').trim();
    if (!bankName) return NextResponse.json({ error: 'Bank name required' }, { status: 400 });
    const isDefault = Boolean(body.isDefault);
    if (isDefault) {
      await prisma.companyBankAccount.updateMany({ where: { companyId }, data: { isDefault: false } });
    }
    const bank = await prisma.companyBankAccount.create({
      data: {
        companyId,
        label: String(body.label || bankName).trim(),
        bankName,
        bankAddress: String(body.bankAddress || '').trim() || null,
        accountLabel: String(body.accountLabel || 'IBAN / Account Number').trim(),
        accountNumber: String(body.accountNumber || '').trim() || null,
        routingLabel: String(body.routingLabel || 'ABA / Routing Number').trim(),
        routingNumber: String(body.routingNumber || '').trim() || null,
        currency: String(body.currency || '').trim() || null,
        isDefault,
      },
    });
    return NextResponse.json({ bank });
  } catch (e) {
    console.error('[POST /api/invoices/banks]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
