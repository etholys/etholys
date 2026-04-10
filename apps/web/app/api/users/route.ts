export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    // Only show users who share at least one company with the current user
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        companyUsers: { some: { companyId: { in: tenant.companyIds } } },
      },
      select: { id: true, name: true, email: true, role: true, phone: true, avatar: true, locale: true, createdAt: true, companyUsers: { include: { company: true } }, departmentUsers: { include: { department: { include: { company: true } } } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Users error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) return NextResponse.json({ error: 'Email ya registrado' }, { status: 400 });
    const hashed = await bcrypt.hash(body.password || 'temp1234', 10);
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email, password: hashed, role: body.role || 'COLLABORATOR', phone: body.phone || null },
    });
    const companyIds: string[] = (body.companyIds || (body.companyId ? [body.companyId] : [])).filter((id: string) => tenant.companyIds.includes(id));
    for (const cid of companyIds) {
      await prisma.companyUser.create({ data: { userId: user.id, companyId: cid, role: body.role || 'COLLABORATOR' } });
    }
    if (body.departmentId) {
      await prisma.departmentUser.create({ data: { userId: user.id, departmentId: body.departmentId } });
    }
    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, companyId, companyIds, departmentId, password, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    const updateData: any = { ...data };
    if (password) updateData.password = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({ where: { id }, data: updateData });
    
    const newCompanyIds: string[] = (companyIds || (companyId ? [companyId] : [])).filter((cid: string) => tenant.companyIds.includes(cid));
    if (newCompanyIds.length > 0 || companyIds !== undefined) {
      await prisma.companyUser.deleteMany({ where: { userId: id } });
      for (const cid of newCompanyIds) {
        if (cid) await prisma.companyUser.create({ data: { userId: id, companyId: cid, role: data.role || 'COLLABORATOR' } });
      }
    }
    if (departmentId !== undefined) {
      await prisma.departmentUser.deleteMany({ where: { userId: id } });
      if (departmentId) {
        await prisma.departmentUser.create({ data: { userId: id, departmentId } });
      }
    }
    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Update user error:', error);
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
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
