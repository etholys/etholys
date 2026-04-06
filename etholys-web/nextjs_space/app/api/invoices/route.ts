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
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    const where: any = {
      companyId: companyId && tenant.companyIds.includes(companyId) ? companyId : { in: tenant.companyIds },
      isActive: true,
    };
    if (type) where.type = type;
    if (status) where.status = status;

    const invoices = await prisma.invoice.findMany({
      where,
      include: { company: true, supplier: true, items: { orderBy: { order: 'asc' } }, relatedInvoice: { select: { id: true, number: true, type: true } }, creditDebitNotes: { select: { id: true, number: true, type: true, total: true, status: true }, where: { isActive: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ invoices });
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

    const count = await prisma.invoice.count({ where: { companyId: body.companyId } });
    const prefixMap: Record<string, string> = { RECEIVABLE: 'INV', PAYABLE: 'BILL', CREDIT_NOTE: 'NC', DEBIT_NOTE: 'ND' };
    const number = `${prefixMap[body.type] || 'DOC'}-${String(count + 1).padStart(4, '0')}`;

    const items = body.items || [];
    const subtotal = items.reduce((s: number, i: any) => s + (i.quantity || 1) * (i.unitPrice || 0), 0);
    const taxAmount = subtotal * ((body.taxRate || 0) / 100);
    const total = subtotal + taxAmount;

    const invoice = await prisma.invoice.create({
      data: {
        companyId: body.companyId,
        supplierId: body.supplierId || null,
        projectId: body.projectId || null,
        relatedInvoiceId: body.relatedInvoiceId || null,
        type: body.type,
        number,
        description: body.description || '',
        contactName: body.counterpartyName || body.contactName || '',
        contactEmail: body.contactEmail || '',
        currency: body.currency || 'USD',
        subtotal,
        taxRate: body.taxRate || 0,
        taxAmount,
        total,
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes || '',
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
      include: { items: true, company: true, supplier: true, relatedInvoice: true },
    });
    return NextResponse.json({ invoice });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const existing = await prisma.invoice.findUnique({ where: { id: body.id }, include: { items: true } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const updateData: any = {};
    if (body.status) updateData.status = body.status;
    if (body.status === 'PAID') updateData.paidDate = new Date();
    if (body.contactName !== undefined) updateData.contactName = body.contactName;
    if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.taxRate !== undefined) updateData.taxRate = body.taxRate;
    if (body.issueDate !== undefined) updateData.issueDate = new Date(body.issueDate);
    if (body.supplierId !== undefined) updateData.supplierId = body.supplierId || null;
    if (body.projectId !== undefined) updateData.projectId = body.projectId || null;
    if (body.counterpartyName !== undefined) updateData.contactName = body.counterpartyName;

    // If items are provided, recalculate totals and replace items
    if (body.items && Array.isArray(body.items)) {
      const subtotal = body.items.reduce((s: number, i: any) => s + (i.quantity || 1) * (i.unitPrice || 0), 0);
      const taxRate = body.taxRate !== undefined ? body.taxRate : existing.taxRate;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;
      updateData.subtotal = subtotal;
      updateData.taxRate = taxRate;
      updateData.taxAmount = taxAmount;
      updateData.total = total;

      // Delete old items and create new ones
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: body.id } });
      await prisma.invoiceItem.createMany({
        data: body.items.map((i: any, idx: number) => ({
          invoiceId: body.id,
          description: i.description || '',
          quantity: i.quantity || 1,
          unitPrice: i.unitPrice || 0,
          total: (i.quantity || 1) * (i.unitPrice || 0),
          order: idx,
        })),
      });
    }

    const invoice = await prisma.invoice.update({
      where: { id: body.id },
      data: updateData,
      include: { items: { orderBy: { order: 'asc' } }, company: true, supplier: true },
    });
    return NextResponse.json({ invoice });
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
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await prisma.invoice.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
