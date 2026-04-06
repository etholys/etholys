export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

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
    const departments = await prisma.department.findMany({ where, orderBy: { name: 'asc' }, include: { company: true, users: { include: { user: { select: { id: true, name: true, email: true, role: true } } } } } });
    return NextResponse.json({ departments });
  } catch (error: any) {
    console.error('Departments error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    if (!tenant.companyIds.includes(body.companyId)) {
      return NextResponse.json({ error: 'No tienes acceso a esta empresa' }, { status: 403 });
    }
    const dept = await prisma.department.create({ data: { companyId: body.companyId, name: body.name, code: body.code || null, headId: body.headId || null }, include: { company: true } });
    return NextResponse.json({ department: dept });
  } catch (error: any) {
    console.error('Create department error:', error);
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
    const existing = await prisma.department.findUnique({ where: { id }, select: { companyId: true } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const dept = await prisma.department.update({ where: { id }, data });
    return NextResponse.json({ department: dept });
  } catch (error: any) {
    console.error('Update department error:', error);
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
    const existing = await prisma.department.findUnique({ where: { id }, select: { companyId: true } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    await prisma.department.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete department error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
