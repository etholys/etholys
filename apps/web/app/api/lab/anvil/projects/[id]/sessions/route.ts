export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnvilAccess, canAccessProject } from '@/lib/lab-anvil/access';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.hasAccess) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }

  const { id: projectId } = await ctx.params;
  if (!(await canAccessProject(access, projectId))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }

  const sessions = await prisma.labAnvilSession.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json({ sessions });
}

export async function POST(req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.hasAccess) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }

  const { id: projectId } = await ctx.params;
  if (!(await canAccessProject(access, projectId))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const session = await prisma.labAnvilSession.create({
    data: {
      projectId,
      createdById: access.userId,
      title: body.title || null,
      status: 'open',
    },
  });

  return NextResponse.json({ session });
}
