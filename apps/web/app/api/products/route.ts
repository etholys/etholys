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

    const products = await prisma.product.findMany({
      where: {
        companyId: companyId && tenant.companyIds.includes(companyId) ? companyId : { in: tenant.companyIds },
        isActive: true,
      },
      include: { company: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ products });
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

    const product = await prisma.product.create({
      data: {
        companyId: body.companyId,
        name: body.name,
        sku: body.sku || null,
        description: body.description || null,
        category: body.category || null,
        unit: body.unit || 'unidad',
        costPrice: body.costPrice ? parseFloat(body.costPrice) : null,
        salePrice: body.salePrice ? parseFloat(body.salePrice) : null,
        currency: body.currency || 'USD',
        stockQty: body.stockQty ? parseFloat(body.stockQty) : 0,
        minStock: body.minStock ? parseFloat(body.minStock) : null,
        location: body.location || null,
      },
    });
    return NextResponse.json({ product });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const existing = await prisma.product.findUnique({ where: { id: body.id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const product = await prisma.product.update({
      where: { id: body.id },
      data: {
        name: body.name ?? existing.name,
        sku: body.sku !== undefined ? body.sku : existing.sku,
        description: body.description !== undefined ? body.description : existing.description,
        category: body.category !== undefined ? body.category : existing.category,
        unit: body.unit !== undefined ? body.unit : existing.unit,
        costPrice: body.costPrice !== undefined ? parseFloat(body.costPrice) : existing.costPrice,
        salePrice: body.salePrice !== undefined ? parseFloat(body.salePrice) : existing.salePrice,
        currency: body.currency !== undefined ? body.currency : existing.currency,
        stockQty: body.stockQty !== undefined ? parseFloat(body.stockQty) : existing.stockQty,
        minStock: body.minStock !== undefined ? parseFloat(body.minStock) : existing.minStock,
        location: body.location !== undefined ? body.location : existing.location,
      },
    });
    return NextResponse.json({ product });
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
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
