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
    const supplierId = searchParams.get('supplierId');

    const where: any = {
      companyId: companyId && tenant.companyIds.includes(companyId) ? companyId : { in: tenant.companyIds },
      isActive: true,
    };
    if (supplierId) where.supplierId = supplierId;

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: { supplier: true, items: { orderBy: { order: 'asc' } }, company: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ orders });
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

    const count = await prisma.purchaseOrder.count({ where: { companyId: body.companyId } });
    const number = `OC-${String(count + 1).padStart(4, '0')}`;

    const items = body.items || [];
    const subtotal = items.reduce((s: number, i: any) => s + (i.quantity || 1) * (i.unitPrice || 0), 0);
    const taxAmount = subtotal * ((body.taxRate || 0) / 100);
    const total = subtotal + taxAmount;

    const order = await prisma.purchaseOrder.create({
      data: {
        companyId: body.companyId,
        supplierId: body.supplierId,
        number,
        currency: body.currency || 'USD',
        subtotal,
        taxRate: body.taxRate || 0,
        taxAmount,
        total,
        orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
        notes: body.notes || null,
        items: {
          create: items.map((i: any, idx: number) => ({
            description: i.description || '',
            quantity: i.quantity || 1,
            unitPrice: i.unitPrice || 0,
            total: (i.quantity || 1) * (i.unitPrice || 0),
            order: idx,
          })),
        },
      },
      include: { items: true, supplier: true, company: true },
    });
    return NextResponse.json({ order });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const existing = await prisma.purchaseOrder.findUnique({ where: { id: body.id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const updateData: any = {};
    if (body.status) {
      updateData.status = body.status;
      if (body.status === 'received') updateData.receivedDate = new Date();
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.expectedDate !== undefined) updateData.expectedDate = body.expectedDate ? new Date(body.expectedDate) : null;

    const order = await prisma.purchaseOrder.update({
      where: { id: body.id },
      data: updateData,
      include: { items: true, supplier: true, company: true },
    });
    return NextResponse.json({ order });
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
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await prisma.purchaseOrder.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
