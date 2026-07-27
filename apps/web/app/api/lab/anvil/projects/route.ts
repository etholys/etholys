export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnvilAccess, canAccessProject } from '@/lib/lab-anvil/access';
import { createAnvilProject, ensureEtholysCoreProject } from '@/lib/lab-anvil/create-project';
import {
  LAB_ANVIL_RELATIONS,
  LAB_ANVIL_VISIBILITIES,
  LAB_ANVIL_WORKSPACE_KINDS,
} from '@/lib/lab-anvil/types';

export async function GET() {
  const access = await requireAnvilAccess();
  if (!access?.hasAccess) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }

  await ensureEtholysCoreProject(access.userId, access.email);

  const projects = await prisma.labAnvilProject.findMany({
    where: access.isOwner
      ? { status: { not: 'archived' } }
      : {
          status: { not: 'archived' },
          members: {
            some: {
              status: 'active',
              OR: [{ userId: access.userId }, { email: access.email.toLowerCase() }],
            },
          },
        },
    include: {
      agent: { select: { id: true, status: true, lastRunAt: true } },
      deployTargets: { orderBy: { createdAt: 'asc' } },
      _count: { select: { sessions: true, members: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Filtrar por canAccess (owners already included)
  const visible = [];
  for (const p of projects) {
    if (access.isOwner || (await canAccessProject(access, p.id))) {
      visible.push(p);
    }
  }

  return NextResponse.json({ projects: visible, isOwner: access.isOwner });
}

export async function POST(req: Request) {
  const access = await requireAnvilAccess();
  if (!access?.hasAccess) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }
  if (!access.isOwner) {
    return NextResponse.json({ error: 'Só owners podem criar projetos' }, { status: 403 });
  }

  const body = await req.json();
  const name = String(body.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Nome requerido' }, { status: 400 });
  }

  const visibility = body.visibility || 'private';
  const relation = body.relation || 'standalone';
  const workspaceKind = body.workspaceKind;

  if (visibility && !LAB_ANVIL_VISIBILITIES.includes(visibility)) {
    return NextResponse.json({ error: 'visibility inválida' }, { status: 400 });
  }
  if (relation && !LAB_ANVIL_RELATIONS.includes(relation)) {
    return NextResponse.json({ error: 'relation inválida' }, { status: 400 });
  }
  if (workspaceKind && !LAB_ANVIL_WORKSPACE_KINDS.includes(workspaceKind)) {
    return NextResponse.json({ error: 'workspaceKind inválido' }, { status: 400 });
  }

  try {
    const project = await createAnvilProject({
      name,
      description: body.description,
      visibility,
      relation,
      workspaceKind,
      repoUrl: body.repoUrl,
      repoPath: body.repoPath,
      defaultBranch: body.defaultBranch,
      allowedReuse: Array.isArray(body.allowedReuse) ? body.allowedReuse : [],
      parentProjectId: body.parentProjectId || undefined,
      createdById: access.userId,
      createdByEmail: access.email,
    });
    return NextResponse.json({ project });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao criar projeto';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
