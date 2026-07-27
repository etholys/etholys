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

  const { id } = await ctx.params;
  const session = await prisma.labAnvilSession.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, slug: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
  }
  if (!(await canAccessProject(access, session.projectId))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }

  return NextResponse.json({ session });
}
