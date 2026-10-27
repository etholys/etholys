export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { accessibleFoldersWhere } from '@/lib/work/folder-access';

type LayoutBody = {
  boardIds?: unknown;
};

function parseBoardIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => String(id || '').trim()).filter(Boolean))];
}

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const companyId = new URL(req.url).searchParams.get('companyId');
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const row = await prisma.workDashboardLayout.findUnique({
      where: { companyId_userId: { companyId, userId: tenant.userId } },
    });

    const layoutJson = (row?.layoutJson as { boardIds?: string[] } | null) || {};
    let boardIds = parseBoardIds(layoutJson.boardIds);

    // Default: all accessible boards until the user customizes.
    if (!row) {
      const boards = await prisma.workFolder.findMany({
        where: {
          ...accessibleFoldersWhere(tenant.userId, companyId),
          kind: 'BOARD',
        },
        select: { id: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        take: 24,
      });
      boardIds = boards.map((b) => b.id);
    } else if (boardIds.length) {
      // Drop boards the user can no longer access.
      const ok = await prisma.workFolder.findMany({
        where: {
          id: { in: boardIds },
          ...accessibleFoldersWhere(tenant.userId, companyId),
          kind: 'BOARD',
        },
        select: { id: true },
      });
      const okSet = new Set(ok.map((b) => b.id));
      boardIds = boardIds.filter((id) => okSet.has(id));
    }

    return NextResponse.json({
      layout: { boardIds },
      personalized: Boolean(row),
    });
  } catch (error: unknown) {
    console.error('Work dashboard GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = (await req.json()) as LayoutBody & { companyId?: string };
    const companyId = String(body.companyId || '');
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    let boardIds = parseBoardIds(body.boardIds);
    if (boardIds.length) {
      const ok = await prisma.workFolder.findMany({
        where: {
          id: { in: boardIds },
          ...accessibleFoldersWhere(tenant.userId, companyId),
          kind: 'BOARD',
        },
        select: { id: true },
      });
      const okSet = new Set(ok.map((b) => b.id));
      boardIds = boardIds.filter((id) => okSet.has(id));
    }

    const layoutJson = { boardIds };
    const row = await prisma.workDashboardLayout.upsert({
      where: { companyId_userId: { companyId, userId: tenant.userId } },
      create: {
        companyId,
        userId: tenant.userId,
        layoutJson,
      },
      update: { layoutJson },
    });

    return NextResponse.json({
      layout: { boardIds: parseBoardIds((row.layoutJson as { boardIds?: string[] })?.boardIds) },
      personalized: true,
    });
  } catch (error: unknown) {
    console.error('Work dashboard PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
