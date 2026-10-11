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
    const signatures = await prisma.companyInvoiceSignature.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({ signatures });
  } catch (e) {
    console.error('[GET /api/invoices/signatures]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const companyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';
    const gate = await companyOk(companyId);
    if (gate.error) return gate.error;
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    if (imageUrl && imageUrl.length > 800_000) {
      return NextResponse.json({ error: 'Signature image too large' }, { status: 400 });
    }
    const isDefault = Boolean(body.isDefault);
    if (isDefault) {
      await prisma.companyInvoiceSignature.updateMany({ where: { companyId }, data: { isDefault: false } });
    }
    const signature = await prisma.companyInvoiceSignature.create({
      data: {
        companyId,
        name,
        title: String(body.title || '').trim() || null,
        companyLine: String(body.companyLine || '').trim() || null,
        imageUrl: imageUrl || null,
        isDefault,
      },
    });
    return NextResponse.json({ signature });
  } catch (e) {
    console.error('[POST /api/invoices/signatures]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
