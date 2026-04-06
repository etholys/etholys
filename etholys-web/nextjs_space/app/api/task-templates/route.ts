export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const templates = await prisma.taskTemplate.findMany({
      where: { isActive: true, OR: [{ companyId: { in: tenant.companyIds } }, { companyId: null }] },
      include: { company: true, creator: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Templates GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const template = await prisma.taskTemplate.create({
      data: {
        name: body.name,
        description: body.description || null,
        companyId: body.companyId || null,
        category: body.category || null,
        tasks: body.tasks || [],
        createdBy: tenant.userId,
      },
    });
    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('Templates POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    const template = await prisma.taskTemplate.update({ where: { id }, data });
    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('Templates PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await prisma.taskTemplate.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Templates DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
