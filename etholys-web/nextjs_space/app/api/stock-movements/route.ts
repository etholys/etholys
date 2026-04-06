export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const companyId = searchParams.get('companyId');

    const where: any = {
      companyId: companyId && tenant.companyIds.includes(companyId) ? companyId : { in: tenant.companyIds },
    };
    if (productId) where.productId = productId;

    const movements = await prisma.stockMovement.findMany({
      where,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ movements });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();

    const product = await prisma.product.findUnique({ where: { id: body.productId } });
    if (!product || !tenant.companyIds.includes(product.companyId)) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const qty = parseFloat(body.quantity) || 0;
    let stockDelta = 0;
    if (body.type === 'IN') stockDelta = qty;
    else if (body.type === 'OUT') stockDelta = -qty;
    else if (body.type === 'ADJUSTMENT') stockDelta = qty - product.stockQty;

    const [movement] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          productId: body.productId,
          companyId: product.companyId,
          type: body.type,
          quantity: qty,
          reference: body.reference || null,
          reason: body.reason || null,
          notes: body.notes || null,
          performedBy: tenant.userId,
        },
      }),
      prisma.product.update({
        where: { id: body.productId },
        data: { stockQty: { increment: stockDelta } },
      }),
    ]);
    return NextResponse.json({ movement });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
