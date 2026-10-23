export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    const folderId = url.searchParams.get('folderId') || '';
    const personal = url.searchParams.get('personal') === '1';

    // Mi trabajo: groups I own in this company, OR any group that still holds my assigned tasks here
    const where = personal
      ? {
          companyId,
          isActive: true,
          OR: [
            { ownerId: tenant.userId },
            {
              tasks: {
                some: {
                  assigneeId: tenant.userId,
                  isActive: true,
                  parentId: null,
                  OR: [{ companyId }, { project: { companyId } }],
                },
              },
            },
          ],
        }
      : folderId
        ? { companyId, isActive: true, folderId, ownerId: null }
        : { companyId, isActive: true, ownerId: null, folderId: null };

    const groups = await prisma.taskGroup.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { tasks: true } } },
    });
    return NextResponse.json({ groups });
  } catch (error: unknown) {
    console.error('Task groups list error:', error);
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
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

    const personal = body.personal === true;
    const folderId = body.folderId ? String(body.folderId) : null;
    if (folderId) {
      const folder = await prisma.workFolder.findFirst({
        where: { id: folderId, companyId, isActive: true },
        select: { id: true },
      });
      if (!folder) return NextResponse.json({ error: 'Tablero no encontrado' }, { status: 404 });
    }

    const max = await prisma.taskGroup.aggregate({
      where: {
        companyId,
        isActive: true,
        ownerId: personal ? tenant.userId : null,
        folderId: personal ? null : folderId,
      },
      _max: { order: true },
    });
    const group = await prisma.taskGroup.create({
      data: {
        companyId,
        name,
        color: body.color ? String(body.color) : null,
        order: (max._max.order ?? -1) + 1,
        ownerId: personal ? tenant.userId : null,
        folderId: personal ? null : folderId,
      },
    });
    return NextResponse.json({ group });
  } catch (error: unknown) {
    console.error('Task group create error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
