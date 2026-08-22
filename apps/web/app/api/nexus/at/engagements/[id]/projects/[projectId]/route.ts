export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  isAtProjectStatus,
  loadEngagementForTenant,
  userIsOperator,
  validateEngagementSiep,
} from '@/lib/nexus-at';

type Ctx = { params: Promise<{ id: string; projectId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, projectId } = await ctx.params;
  const engagement = await loadEngagementForTenant(id, tenant.companyIds);
  if (!engagement) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });
  if (!userIsOperator(engagement, tenant.companyIds)) {
    return NextResponse.json({ error: 'Só o operador pode editar projetos.' }, { status: 403 });
  }

  const existing = engagement.projects.find((p) => p.id === projectId);
  if (!existing) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.name != null) {
    const name = String(body.name).trim();
    if (name.length < 2) return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 });
    data.name = name.slice(0, 200);
  }
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description).trim().slice(0, 4000) : null;
  }
  if (body.status != null) {
    const status = String(body.status).trim().toUpperCase();
    if (!isAtProjectStatus(status)) {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
    }
    data.status = status;
  }
  if (body.siepProjectId !== undefined) {
    const siepProjectId = body.siepProjectId ? String(body.siepProjectId).trim() : null;
    if (siepProjectId) {
      const allowed = [engagement.operatorCompanyId, ...engagement.members.map((m) => m.companyId)];
      const v = await validateEngagementSiep(siepProjectId, allowed);
      if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });
    }
    data.siepProjectId = siepProjectId;
  }

  const project = await prisma.nexusAtProject.update({
    where: { id: projectId },
    data,
    include: { siepProject: { select: { id: true, name: true, companyId: true } } },
  });

  await prisma.nexusAtEngagement.update({
    where: { id: engagement.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, project });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, projectId } = await ctx.params;
  const engagement = await loadEngagementForTenant(id, tenant.companyIds);
  if (!engagement) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });
  if (!userIsOperator(engagement, tenant.companyIds)) {
    return NextResponse.json({ error: 'Só o operador pode arquivar projetos.' }, { status: 403 });
  }

  const existing = engagement.projects.find((p) => p.id === projectId);
  if (!existing) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 });

  await prisma.nexusAtProject.update({
    where: { id: projectId },
    data: { isActive: false, status: 'DONE' },
  });

  return NextResponse.json({ ok: true });
}
