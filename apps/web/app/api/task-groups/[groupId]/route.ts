export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

async function assertGroupAccess(groupId: string, companyIds: string[]) {
  const group = await prisma.taskGroup.findFirst({
    where: { id: groupId, isActive: true },
  });
  if (!group || !companyIds.includes(group.companyId)) return null;
  return group;
}

export async function PUT(req: Request, { params }: { params: { groupId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const existing = await assertGroupAccess(params.groupId, tenant.companyIds);
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.color !== undefined) data.color = body.color || null;
    if (body.order !== undefined) data.order = parseInt(String(body.order), 10) || 0;

    const group = await prisma.taskGroup.update({
      where: { id: params.groupId },
      data,
    });
    return NextResponse.json({ group });
  } catch (error: unknown) {
    console.error('Task group update error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { groupId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const existing = await assertGroupAccess(params.groupId, tenant.companyIds);
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    await prisma.$transaction([
      prisma.task.updateMany({ where: { groupId: params.groupId }, data: { groupId: null } }),
      prisma.taskGroup.update({ where: { id: params.groupId }, data: { isActive: false } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Task group delete error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
