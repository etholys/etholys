export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnvilAccess, canAccessProject } from '@/lib/lab-anvil/access';
import { LAB_ANVIL_DEPLOY_KINDS } from '@/lib/lab-anvil/types';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.hasAccess) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }

  const { id: projectId } = await ctx.params;
  if (!(await canAccessProject(access, projectId))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }
  if (!access.isOwner) {
    return NextResponse.json({ error: 'Só owners' }, { status: 403 });
  }

  const body = await req.json();
  const kind = body.kind as string;
  const label = String(body.label || kind || '').trim();
  if (!LAB_ANVIL_DEPLOY_KINDS.includes(kind as never)) {
    return NextResponse.json({ error: 'kind inválido' }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: 'label requerido' }, { status: 400 });
  }

  if (body.isDefault) {
    await prisma.labAnvilDeployTarget.updateMany({
      where: { projectId },
      data: { isDefault: false },
    });
  }

  const target = await prisma.labAnvilDeployTarget.create({
    data: {
      projectId,
      kind,
      label,
      isDefault: !!body.isDefault,
      configJson: body.configJson ?? undefined,
      status: 'idle',
    },
  });

  return NextResponse.json({ target });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.isOwner) {
    return NextResponse.json({ error: 'Só owners' }, { status: 403 });
  }

  const { id: projectId } = await ctx.params;
  const body = await req.json();
  const targetId = body.id as string;
  if (!targetId) {
    return NextResponse.json({ error: 'id do target requerido' }, { status: 400 });
  }

  if (body.isDefault) {
    await prisma.labAnvilDeployTarget.updateMany({
      where: { projectId },
      data: { isDefault: false },
    });
  }

  const target = await prisma.labAnvilDeployTarget.update({
    where: { id: targetId },
    data: {
      ...(body.label !== undefined && { label: body.label }),
      ...(body.kind !== undefined && { kind: body.kind }),
      ...(body.isDefault !== undefined && { isDefault: !!body.isDefault }),
      ...(body.configJson !== undefined && { configJson: body.configJson }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  return NextResponse.json({ target });
}
