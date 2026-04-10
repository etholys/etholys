export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET() {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const companies = await prisma.company.findMany({
      where: { id: { in: tenant.companyIds }, isActive: true },
      include: { departments: true, _count: { select: { companyUsers: true, projects: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ companies });
  } catch (error: any) {
    console.error('Companies error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // Verify the user actually exists in DB (JWT may be stale after DB reset)
    const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!dbUser) {
      // Try to find by email as fallback
      const userByEmail = await prisma.user.findUnique({ where: { email: session.user.email! } });
      if (!userByEmail) return NextResponse.json({ error: 'Usuario no encontrado. Por favor cierra sesión e inicia de nuevo.' }, { status: 401 });
      // Use the real DB user id
      const body = await req.json();
      const company = await prisma.company.create({
        data: { name: body.name, shortName: body.shortName, description: body.description || null, color: body.color || '#0D9488', currency: body.currency || 'USD' },
      });
      await prisma.companyUser.create({ data: { userId: userByEmail.id, companyId: company.id, role: 'ADMIN', isDefault: false } });
      return NextResponse.json({ company });
    }

    const body = await req.json();
    const company = await prisma.company.create({
      data: { name: body.name, shortName: body.shortName, description: body.description || null, color: body.color || '#0D9488', currency: body.currency || 'USD' },
    });
    await prisma.companyUser.create({ data: { userId: session.user.id, companyId: company.id, role: 'ADMIN', isDefault: false } });
    return NextResponse.json({ company });
  } catch (error: any) {
    console.error('Create company error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, ...data } = body;
    if (!id || !tenant.companyIds.includes(id)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const company = await prisma.company.update({ where: { id }, data });
    return NextResponse.json({ company });
  } catch (error: any) {
    console.error('Update company error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || !tenant.companyIds.includes(id)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await prisma.company.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete company error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
