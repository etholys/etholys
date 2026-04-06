export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

const DEFAULT_CATEGORIES = [
  'Salarios', 'Materiales', 'Equipamiento', 'Transporte',
  'Capacitaci\u00f3n', 'Consultor\u00eda', 'Administrativo',
  'Comunicaci\u00f3n', 'Servicios', 'Donaci\u00f3n',
  'Subvenci\u00f3n', 'Venta', 'Otro'
];

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    const where: any = { isActive: true };
    if (companyId && tenant.companyIds.includes(companyId)) {
      where.companyId = companyId;
    } else {
      where.companyId = { in: tenant.companyIds };
    }

    const categories = await prisma.transactionCategory.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ categories, defaults: DEFAULT_CATEGORIES });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    if (!body.companyId || !body.name) {
      return NextResponse.json({ error: 'companyId y name son requeridos' }, { status: 400 });
    }
    if (!tenant.companyIds.includes(body.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const category = await prisma.transactionCategory.upsert({
      where: { companyId_name: { companyId: body.companyId, name: body.name } },
      update: { isActive: true, color: body.color || '#6B7280' },
      create: {
        companyId: body.companyId,
        name: body.name,
        color: body.color || '#6B7280',
      },
    });
    return NextResponse.json({ category });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const cat = await prisma.transactionCategory.findUnique({ where: { id } });
    if (!cat || !tenant.companyIds.includes(cat.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.transactionCategory.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
