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
    const status = searchParams.get('status');
    const where: any = { isActive: true };
    // Tenant isolation: only projects from user's companies
    if (companyId && tenant.companyIds.includes(companyId)) {
      where.companyId = companyId;
    } else {
      where.companyId = { in: tenant.companyIds };
    }
    if (status) where.status = status;
    const projects = await prisma.project.findMany({
      where,
      include: { company: true, members: { include: { user: true } }, _count: { select: { tasks: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error('Projects error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    // Verify user belongs to the target company
    if (body.companyId && !tenant.companyIds.includes(body.companyId)) {
      return NextResponse.json({ error: 'No tienes acceso a esta empresa' }, { status: 403 });
    }
    const project = await prisma.project.create({
      data: { ...body },
      include: { company: true },
    });
    return NextResponse.json({ project });
  } catch (error: any) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
