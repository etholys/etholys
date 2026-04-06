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
    // Show system roles (companyId null) + roles from user's companies
    if (companyId && tenant.companyIds.includes(companyId)) {
      where.OR = [{ companyId }, { companyId: null }];
    } else {
      where.OR = [{ companyId: { in: tenant.companyIds } }, { companyId: null }];
    }
    const roles = await prisma.customRole.findMany({ where, orderBy: [{ isSystem: 'desc' }, { level: 'desc' }, { name: 'asc' }], include: { company: true } });
    return NextResponse.json({ roles });
  } catch (error: any) {
    console.error('Roles error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const role = await prisma.customRole.create({
      data: { name: body.name, description: body.description || '', code: body.code || body.name.toUpperCase().replace(/\s+/g, '_'), companyId: body.companyId || null, level: body.level || 0, permissions: body.permissions || null, color: body.color || '#6b7280' },
    });
    return NextResponse.json({ role });
  } catch (error: any) {
    console.error('Create role error:', error);
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
    const existing = await prisma.customRole.findUnique({ where: { id } });
    if (existing?.isSystem) return NextResponse.json({ error: 'No se puede editar un rol del sistema' }, { status: 403 });
    const role = await prisma.customRole.update({ where: { id }, data });
    return NextResponse.json({ role });
  } catch (error: any) {
    console.error('Update role error:', error);
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
    const existing = await prisma.customRole.findUnique({ where: { id } });
    if (existing?.isSystem) return NextResponse.json({ error: 'No se puede eliminar un rol del sistema' }, { status: 403 });
    await prisma.customRole.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete role error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
