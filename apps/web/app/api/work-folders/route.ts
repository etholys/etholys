export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const companyId = new URL(req.url).searchParams.get('companyId');
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const folders = await prisma.workFolder.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { ownerId: tenant.userId },
          { visibility: 'SHARED', members: { some: { userId: tenant.userId } } },
          // SHARED sem membros extra: dono já coberto; outros da empresa veem pastas SHARED?
          // Política: SHARED visível a todos os membros da empresa (estilo ClickUp space).
          { visibility: 'SHARED' },
        ],
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { tasks: true } },
      },
    });

    // Deduplicate if OR matches twice
    const seen = new Set<string>();
    const unique = folders.filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });

    return NextResponse.json({ folders: unique });
  } catch (error: unknown) {
    console.error('Work folders list error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const companyId = String(body.companyId || '');
    const name = String(body.name || '').trim();
    const visibility = body.visibility === 'SHARED' ? 'SHARED' : 'PERSONAL';
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

    const max = await prisma.workFolder.aggregate({
      where: { companyId, ownerId: tenant.userId, isActive: true },
      _max: { order: true },
    });

    const memberIds: string[] = Array.isArray(body.memberIds)
      ? body.memberIds.map(String).filter((id: string) => id && id !== tenant.userId)
      : [];

    const folder = await prisma.workFolder.create({
      data: {
        companyId,
        name,
        color: body.color ? String(body.color) : null,
        visibility,
        ownerId: tenant.userId,
        order: (max._max.order ?? -1) + 1,
        members:
          visibility === 'SHARED' && memberIds.length
            ? {
                create: memberIds.map((userId) => ({ userId, role: 'member' })),
              }
            : undefined,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { tasks: true } },
      },
    });

    return NextResponse.json({ folder });
  } catch (error: unknown) {
    console.error('Work folder create error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
