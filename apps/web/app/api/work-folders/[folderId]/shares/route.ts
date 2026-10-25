export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canManageFolderShares, getFolderAccess } from '@/lib/work/folder-access';
import { createWorkFolderShare } from '@/lib/work/folder-share';

type Ctx = { params: { folderId: string } };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { folderId } = ctx.params;
    const access = await getFolderAccess(folderId, tenant.userId, tenant.companyIds);
    if (!access || !canManageFolderShares(access.access)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }
    const shares = await prisma.workFolderShare.findMany({
      where: { folderId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        accessMode: true,
        acceptedAt: true,
        expiresAt: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ shares });
  } catch (e) {
    console.error('work folder shares list', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { folderId } = ctx.params;
    const access = await getFolderAccess(folderId, tenant.userId, tenant.companyIds);
    if (!access || !canManageFolderShares(access.access)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim();
    const role = body.role === 'editor' ? 'editor' : 'viewer';
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 });

    const result = await createWorkFolderShare({
      companyId: access.folder.companyId,
      folderId,
      invitedById: tenant.userId,
      email,
      role,
      sendEmail: body.sendEmail !== false,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    console.error('work folder share create', e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { folderId } = ctx.params;
    const access = await getFolderAccess(folderId, tenant.userId, tenant.companyIds);
    if (!access || !canManageFolderShares(access.access)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }
    const url = new URL(req.url);
    const shareId = url.searchParams.get('shareId') || '';
    if (!shareId) return NextResponse.json({ error: 'shareId requerido' }, { status: 400 });

    const share = await prisma.workFolderShare.findFirst({
      where: { id: shareId, folderId, status: 'active' },
    });
    if (!share) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    await prisma.workFolderShare.update({
      where: { id: shareId },
      data: { status: 'revoked' },
    });
    if (share.userId) {
      await prisma.workFolderMember.deleteMany({
        where: { folderId, userId: share.userId },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('work folder share revoke', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
