export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

async function assertFolderAccess(
  folderId: string,
  tenant: { userId: string; companyIds: string[] },
  opts?: { requireOwner?: boolean },
) {
  const folder = await prisma.workFolder.findFirst({
    where: { id: folderId, isActive: true },
    include: { members: true },
  });
  if (!folder || !tenant.companyIds.includes(folder.companyId)) return null;
  const isOwner = folder.ownerId === tenant.userId;
  const isMember = folder.members.some((m) => m.userId === tenant.userId);
  const canSee =
    isOwner ||
    (folder.visibility === 'SHARED' && (isMember || true)); // SHARED visible company-wide
  if (!canSee) return null;
  if (opts?.requireOwner && !isOwner) return null;
  return folder;
}

export async function GET(_req: Request, { params }: { params: { folderId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const access = await assertFolderAccess(params.folderId, tenant);
    if (!access) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const folder = await prisma.workFolder.findFirst({
      where: { id: params.folderId, isActive: true },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { tasks: true } },
      },
    });
    return NextResponse.json({ folder });
  } catch (error: unknown) {
    console.error('Work folder get error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { folderId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const existing = await assertFolderAccess(params.folderId, tenant, { requireOwner: true });
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.color !== undefined) data.color = body.color || null;
    if (body.order !== undefined) data.order = parseInt(String(body.order), 10) || 0;
    if (body.visibility === 'PERSONAL' || body.visibility === 'SHARED') {
      data.visibility = body.visibility;
    }

    if (Array.isArray(body.memberIds)) {
      const ids = body.memberIds.map(String).filter((id: string) => id && id !== tenant.userId);
      await prisma.workFolderMember.deleteMany({ where: { folderId: params.folderId } });
      if (ids.length) {
        await prisma.workFolderMember.createMany({
          data: ids.map((userId: string) => ({ folderId: params.folderId, userId, role: 'member' })),
          skipDuplicates: true,
        });
      }
    }

    const folder = await prisma.workFolder.update({
      where: { id: params.folderId },
      data,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { tasks: true } },
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
    const existing = await assertFolderAccess(params.folderId, tenant, { requireOwner: true });
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

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
