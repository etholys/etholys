export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  canManageFolder,
  canManageFolderShares,
  getFolderAccess,
  parseWorkFolderRole,
} from '@/lib/work/folder-access';

export async function GET(_req: Request, { params }: { params: { folderId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const access = await getFolderAccess(params.folderId, tenant.userId, tenant.companyIds);
    if (!access) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const folder = await prisma.workFolder.findFirst({
      where: { id: params.folderId, isActive: true },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { tasks: true, members: true } },
      },
    });
    return NextResponse.json({ folder, access: access.access });
  } catch (error: unknown) {
    console.error('Work folder get error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { folderId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const access = await getFolderAccess(params.folderId, tenant.userId, tenant.companyIds);
    if (!access) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};

    const wantsMeta =
      body.name !== undefined ||
      body.color !== undefined ||
      body.order !== undefined ||
      body.visibility !== undefined;
    const wantsMembers = Array.isArray(body.members) || Array.isArray(body.memberIds);

    if (wantsMeta && !canManageFolder(access.access)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }
    if (wantsMembers && !canManageFolderShares(access.access)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.color !== undefined) data.color = body.color || null;
    if (body.order !== undefined) data.order = parseInt(String(body.order), 10) || 0;
    if (body.visibility === 'PERSONAL' || body.visibility === 'SHARED') {
      data.visibility = body.visibility;
    }

    if (wantsMembers) {
      type MemberIn = { userId: string; role: string };
      let next: MemberIn[] = [];
      if (Array.isArray(body.members)) {
        next = body.members
          .map((m: { userId?: string; role?: string }) => ({
            userId: String(m?.userId || ''),
            role: parseWorkFolderRole(m?.role, 'viewer') === 'editor' ? 'editor' : 'viewer',
          }))
          .filter((m: MemberIn) => m.userId && m.userId !== tenant.userId);
      } else if (Array.isArray(body.memberIds)) {
        next = body.memberIds
          .map(String)
          .filter((id: string) => id && id !== tenant.userId)
          .map((userId: string) => ({ userId, role: 'viewer' }));
      }

      const ok = await prisma.companyUser.findMany({
        where: {
          companyId: access.folder.companyId,
          userId: { in: next.map((m) => m.userId) },
        },
        select: { userId: true },
      });
      const okSet = new Set(ok.map((r) => r.userId));
      next = next.filter((m) => okSet.has(m.userId));

      await prisma.workFolderMember.deleteMany({ where: { folderId: params.folderId } });
      if (next.length) {
        await prisma.workFolderMember.createMany({
          data: next.map((m) => ({ folderId: params.folderId, userId: m.userId, role: m.role })),
          skipDuplicates: true,
        });
      }
      // Inviting people implies SHARED visibility
      if (next.length && data.visibility === undefined) {
        data.visibility = 'SHARED';
      }
    }

    const folder = await prisma.workFolder.update({
      where: { id: params.folderId },
      data,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { tasks: true, members: true } },
      },
    });
    return NextResponse.json({ folder });
  } catch (error: unknown) {
    console.error('Work folder update error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { folderId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const access = await getFolderAccess(params.folderId, tenant.userId, tenant.companyIds);
    if (!access || !canManageFolder(access.access)) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.task.updateMany({ where: { folderId: params.folderId }, data: { folderId: null } }),
      prisma.workFolder.update({ where: { id: params.folderId }, data: { isActive: false } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Work folder delete error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
