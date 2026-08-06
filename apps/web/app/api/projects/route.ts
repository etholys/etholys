export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { getGuestProjectIds } from '@/lib/siep/permissions';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');
    const includeInactive = searchParams.get('includeInactive') === '1';

    const companyMemberIds = (
      await prisma.companyUser.findMany({
        where: { userId: tenant.userId },
        select: { companyId: true },
      })
    ).map((r) => r.companyId);

    const guestProjectIds = await getGuestProjectIds(tenant.userId);

    const where: any = {
      AND: [
        includeInactive ? {} : { isActive: true },
        status ? { status } : {},
        {
          OR: [
            // Membro da empresa: todos os projetos da(s) empresa(s)
            companyId && companyMemberIds.includes(companyId)
              ? { companyId }
              : companyMemberIds.length
                ? { companyId: { in: companyMemberIds } }
                : { id: { in: [] as string[] } },
            // Convidado só de projeto
            guestProjectIds.length ? { id: { in: guestProjectIds } } : { id: { in: [] as string[] } },
          ],
        },
      ],
    };

    // Se filtrar por companyId e o user só é guest nessa empresa, limitar aos projetos guest
    if (companyId && !companyMemberIds.includes(companyId) && tenant.companyIds.includes(companyId)) {
      where.AND.push({ companyId, id: { in: guestProjectIds } });
    }

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
    // Verify user belongs to the target company as CompanyUser (guests cannot create projects)
    if (body.companyId) {
      const cu = await prisma.companyUser.findUnique({
        where: { userId_companyId: { userId: tenant.userId, companyId: body.companyId } },
      });
      if (!cu) {
        return NextResponse.json({ error: 'No tienes acceso a esta empresa' }, { status: 403 });
      }
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
