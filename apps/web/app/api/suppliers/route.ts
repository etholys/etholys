export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    const suppliers = await prisma.supplier.findMany({
      where: {
        companyId: companyId && tenant.companyIds.includes(companyId) ? companyId : { in: tenant.companyIds },
        isActive: true,
      },
      include: { _count: { select: { invoices: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ suppliers });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    if (!tenant.companyIds.includes(body.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supplier = await prisma.supplier.create({
      data: {
        companyId: body.companyId,
        name: body.name,
        tradeName: body.tradeName || null,
        taxId: body.taxId || null,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        city: body.city || null,
        country: body.country || null,
        category: body.category || null,
        rating: body.rating ? parseInt(body.rating) : null,
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ supplier });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const existing = await prisma.supplier.findUnique({ where: { id: body.id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supplier = await prisma.supplier.update({
      where: { id: body.id },
      data: {
        name: body.name ?? existing.name,
        tradeName: body.tradeName !== undefined ? body.tradeName : existing.tradeName,
        taxId: body.taxId !== undefined ? body.taxId : existing.taxId,
        email: body.email !== undefined ? body.email : existing.email,
        phone: body.phone !== undefined ? body.phone : existing.phone,
        address: body.address !== undefined ? body.address : existing.address,
        city: body.city !== undefined ? body.city : existing.city,
        country: body.country !== undefined ? body.country : existing.country,
        category: body.category !== undefined ? body.category : existing.category,
        rating: body.rating !== undefined ? parseInt(body.rating) : existing.rating,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
    });
    return NextResponse.json({ supplier });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await prisma.supplier.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
