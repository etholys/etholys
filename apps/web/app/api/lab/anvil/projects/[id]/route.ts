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
  if (!(await canAccessProject(access, id))) {
    return NextResponse.json({ error: 'Sem acesso a este projeto' }, { status: 403 });
  }

  const project = await prisma.labAnvilProject.findUnique({
    where: { id },
    include: {
      agent: true,
      deployTargets: { orderBy: { createdAt: 'asc' } },
      members: {
        where: { status: { not: 'revoked' } },
        orderBy: { createdAt: 'desc' },
      },
      sessions: {
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: { _count: { select: { messages: true } } },
      },
      childProjects: { select: { id: true, slug: true, name: true, relation: true } },
      parentProject: { select: { id: true, slug: true, name: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ project, isOwner: access.isOwner });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.hasAccess) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!(await canAccessProject(access, id))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }
  if (!access.isOwner) {
    return NextResponse.json({ error: 'Só owners podem editar projeto' }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of [
    'name',
    'description',
    'visibility',
    'relation',
    'workspaceKind',
    'repoUrl',
    'repoPath',
    'defaultBranch',
    'status',
    'parentProjectId',
  ] as const) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.allowedReuse !== undefined) data.allowedReuse = body.allowedReuse;

  if (data.visibility === 'public_oss' && data.workspaceKind === 'etholys_monorepo') {
    return NextResponse.json(
      { error: 'public_oss não pode usar etholys_monorepo' },
      { status: 400 },
    );
  }

  const project = await prisma.labAnvilProject.update({
    where: { id },
    data,
    include: { agent: true, deployTargets: true },
  });

  if (body.systemPromptExtra !== undefined && project.agent) {
    await prisma.labAnvilAgent.update({
      where: { id: project.agent.id },
      data: { systemPromptExtra: body.systemPromptExtra },
    });
  }

  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.isOwner) {
    return NextResponse.json({ error: 'Só owners' }, { status: 403 });
  }

  const { id } = await ctx.params;
  await prisma.labAnvilProject.update({
    where: { id },
    data: { status: 'archived' },
  });
  return NextResponse.json({ success: true });
}
