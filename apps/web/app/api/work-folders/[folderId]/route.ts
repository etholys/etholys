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
      body.visibility !== undefined ||
      body.parentId !== undefined ||
      body.kind !== undefined;
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

    if (body.parentId !== undefined) {
      const nextParent = body.parentId ? String(body.parentId) : null;
      if (nextParent === params.folderId) {
        return NextResponse.json({ error: 'Carpeta inválida' }, { status: 400 });
      }
      if (nextParent) {
        // Prevent cycles: walk ancestors
        let walk: string | null = nextParent;
        const seen = new Set<string>([params.folderId]);
        while (walk) {
          if (seen.has(walk)) {
            return NextResponse.json({ error: 'Ciclo de carpetas' }, { status: 400 });
          }
          seen.add(walk);
          const row = await prisma.workFolder.findFirst({
            where: { id: walk, isActive: true },
            select: { parentId: true, kind: true, companyId: true },
          });
          if (!row || row.companyId !== access.folder.companyId) {
            return NextResponse.json({ error: 'Carpeta padre no encontrada' }, { status: 404 });
          }
          if (row.kind === 'BOARD') {
            return NextResponse.json(
              { error: 'No se puede anidar dentro de un tablero' },
              { status: 400 },
            );
          }
          walk = row.parentId;
        }
        const parentAccess = await getFolderAccess(nextParent, tenant.userId, tenant.companyIds);
        if (!parentAccess) {
          return NextResponse.json({ error: 'Carpeta padre no encontrada' }, { status: 404 });
        }
      }
      data.parentId = nextParent;
    }

    // Promote/demote only when empty of the wrong shape (boards with tasks stay boards).
    if (body.kind === 'FOLDER' || body.kind === 'BOARD') {
      if (body.kind === 'FOLDER') {
        const taskCount = await prisma.task.count({
          where: { folderId: params.folderId, isActive: true },
        });
        if (taskCount > 0) {
          return NextResponse.json(
            { error: 'Mueve o archiva las tareas antes de convertir el tablero en carpeta' },
            { status: 400 },
          );
        }
      }
      data.kind = body.kind;
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

    // Convert to PERSONAL: drop ACL so the board leaves “Compartidos” (legacy boards included).
    if (data.visibility === 'PERSONAL') {
      if (!wantsMembers) {
        await prisma.workFolderMember.deleteMany({ where: { folderId: params.folderId } });
      }
      await prisma.workFolderShare.updateMany({
        where: { folderId: params.folderId, status: 'active' },
        data: { status: 'revoked' },
      });
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

    // Soft-delete node + descendants (unlimited nesting).
    const toDisable = new Set<string>([params.folderId]);
    let frontier = [params.folderId];
    while (frontier.length) {
      const kids = await prisma.workFolder.findMany({
        where: { parentId: { in: frontier }, isActive: true },
        select: { id: true },
      });
      frontier = [];
      for (const k of kids) {
        if (!toDisable.has(k.id)) {
          toDisable.add(k.id);
          frontier.push(k.id);
        }
      }
    }
    const ids = [...toDisable];
    await prisma.$transaction([
      prisma.task.updateMany({ where: { folderId: { in: ids } }, data: { folderId: null } }),
      prisma.workFolder.updateMany({ where: { id: { in: ids } }, data: { isActive: false } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Work folder delete error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
