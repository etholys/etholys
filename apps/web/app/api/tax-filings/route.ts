export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const where: any = { isActive: true, companyId: { in: tenant.companyIds } };
    if (companyId) where.companyId = companyId;
    const filings = await prisma.taxFiling.findMany({
      where,
      include: { company: { select: { id: true, name: true, shortName: true, ein: true } }, createdBy: { select: { id: true, name: true } } },
      orderBy: [{ taxYear: 'desc' }, { formType: 'asc' }],
    });
    return NextResponse.json({ filings });
  } catch (error: any) {
    console.error('Tax filings GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { companyId, formType, taxYear } = body;
    if (!companyId || !formType || !taxYear) {
      return NextResponse.json({ error: 'companyId, formType y taxYear son requeridos' }, { status: 400 });
    }
    // Check if filing already exists
    const existing = await prisma.taxFiling.findUnique({
      where: { companyId_formType_taxYear: { companyId, formType, taxYear: parseInt(taxYear) } },
    });
    if (existing && existing.isActive) {
      return NextResponse.json({ filing: existing });
    }
    const filing = await prisma.taxFiling.create({
      data: {
        companyId,
        formType,
        taxYear: parseInt(taxYear),
        createdById: (session.user as any).id,
        status: 'draft',
        formData: body.formData || {},
      },
    });
    return NextResponse.json({ filing });
  } catch (error: any) {
    console.error('Tax filings POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    const filing = await prisma.taxFiling.update({ where: { id }, data });
    return NextResponse.json({ filing });
  } catch (error: any) {
    console.error('Tax filings PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await prisma.taxFiling.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Tax filings DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
