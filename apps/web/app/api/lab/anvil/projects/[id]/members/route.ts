export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnvilAccess, canAccessProject } from '@/lib/lab-anvil/access';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.isOwner) {
    return NextResponse.json({ error: 'Só owners' }, { status: 403 });
  }

  const { id: projectId } = await ctx.params;
  if (!(await canAccessProject(access, projectId))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }

  const body = await req.json();
  const email = String(body.email || '').toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const member = await prisma.labAnvilProjectMember.upsert({
    where: { projectId_email: { projectId, email } },
    create: {
      projectId,
      email,
      userId: user?.id ?? null,
      role: body.role === 'owner' ? 'owner' : 'collaborator',
      status: 'active',
      invitedById: access.userId,
    },
    update: {
      status: 'active',
      userId: user?.id ?? undefined,
      role: body.role === 'owner' ? 'owner' : 'collaborator',
    },
  });

  return NextResponse.json({ member });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.isOwner) {
    return NextResponse.json({ error: 'Só owners' }, { status: 403 });
  }

  const { id: projectId } = await ctx.params;
  const body = await req.json();
  const memberId = body.id as string;
  if (!memberId) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  await prisma.labAnvilProjectMember.updateMany({
    where: { id: memberId, projectId },
    data: { status: 'revoked' },
  });

  return NextResponse.json({ success: true });
}
