export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { planInvoiceDuplicates } from '@/lib/atlas/invoice-ops';
import { takeInvoiceNumbers } from '@/lib/atlas/invoice-issue';

export async function POST(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as { id?: string; months?: number };
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const source = await prisma.invoice.findUnique({
      where: { id },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    if (!source || !tenant.companyIds.includes(source.companyId) || !source.isActive) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    const plans = planInvoiceDuplicates(source, body.months ?? 1);
    const numbers = await takeInvoiceNumbers({
      companyId: source.companyId,
      count: plans.length,
      when: plans[0]?.issueDate,
    });

    const created = await prisma.$transaction(
      plans.map((plan, i) =>
        prisma.invoice.create({
          data: {
            companyId: source.companyId,
            supplierId: source.supplierId,
            projectId: source.projectId,
            type: source.type,
            status: 'DRAFT',
            number: numbers[i] || `${source.number}-${plan.offset}`,
            description: plan.description,
            contactName: source.contactName,
            contactEmail: source.contactEmail,
            contactPhone: source.contactPhone,
            contactAddress: source.contactAddress,
            contactExtra: source.contactExtra,
            clientId: source.clientId,
            currency: source.currency,
            altCurrency: source.altCurrency,
            exchangeRate: source.exchangeRate,
            exchangeRateDate: source.exchangeRateDate,
            exchangeRateSource: source.exchangeRateSource,
            bankAccountId: source.bankAccountId,
            signatureId: source.signatureId,
            signatureImage: source.signatureImage,
            subtotal: source.subtotal,
            taxRate: source.taxRate,
            taxAmount: source.taxAmount,
            total: source.total,
            issueDate: new Date(`${plan.issueDate}T12:00:00.000Z`),
            dueDate: plan.dueDate ? new Date(`${plan.dueDate}T12:00:00.000Z`) : null,
            notes: plan.notes,
            items: {
              create: plan.items.map((it, idx) => ({
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                total: (it.quantity || 1) * (it.unitPrice || 0),
                order: idx,
              })),
            },
          },
          include: { items: true },
        }),
      ),
    );

    return NextResponse.json({ invoices: created, count: created.length });
  } catch (e: unknown) {
    console.error('[POST /api/invoices/duplicate]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
