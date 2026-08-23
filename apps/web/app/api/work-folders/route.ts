export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { accessibleFoldersWhere, parseWorkFolderRole } from '@/lib/work/folder-access';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const companyId = new URL(req.url).searchParams.get('companyId');
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    // Drive-like: only owner or explicit members (SHARED is not company-wide).
    const folders = await prisma.workFolder.findMany({
      where: accessibleFoldersWhere(tenant.userId, companyId),
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { tasks: true, members: true } },
      },
    });

    return NextResponse.json({ folders });
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

    type MemberIn = { userId: string; role: string };
    let membersCreate: MemberIn[] = [];
    if (Array.isArray(body.members)) {
      membersCreate = body.members
        .map((m: { userId?: string; role?: string }) => ({
          userId: String(m?.userId || ''),
          role: parseWorkFolderRole(m?.role, 'viewer') === 'editor' ? 'editor' : 'viewer',
        }))
        .filter((m: MemberIn) => m.userId && m.userId !== tenant.userId);
    } else if (Array.isArray(body.memberIds)) {
      membersCreate = body.memberIds
        .map(String)
        .filter((id: string) => id && id !== tenant.userId)
        .map((userId: string) => ({ userId, role: 'viewer' }));
    }

    // Validate invitees are company members
    if (membersCreate.length) {
      const ok = await prisma.companyUser.findMany({
        where: {
          companyId,
          userId: { in: membersCreate.map((m) => m.userId) },
        },
        select: { userId: true },
      });
      const okSet = new Set(ok.map((r) => r.userId));
      membersCreate = membersCreate.filter((m) => okSet.has(m.userId));
    }

    const folder = await prisma.workFolder.create({
      data: {
        companyId,
        name,
        color: body.color ? String(body.color) : null,
        visibility,
        ownerId: tenant.userId,
        order: (max._max.order ?? -1) + 1,
        members: membersCreate.length
          ? { create: membersCreate.map((m) => ({ userId: m.userId, role: m.role })) }
          : undefined,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { tasks: true, members: true } },
      },
    });

    return NextResponse.json({ folder });
  } catch (error: unknown) {
    console.error('Work folder create error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
