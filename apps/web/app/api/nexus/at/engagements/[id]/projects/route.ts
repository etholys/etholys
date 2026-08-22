export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  loadEngagementForTenant,
  userIsOperator,
  validateEngagementSiep,
} from '@/lib/nexus-at';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const engagement = await loadEngagementForTenant(id, tenant.companyIds);
  if (!engagement) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });

  return NextResponse.json({
    projects: engagement.projects,
    isOperator: userIsOperator(engagement, tenant.companyIds),
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const engagement = await loadEngagementForTenant(id, tenant.companyIds);
  if (!engagement) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });
  if (!userIsOperator(engagement, tenant.companyIds)) {
    return NextResponse.json({ error: 'Só o operador pode criar projetos neste serviço.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const name = String(body.name || '').trim();
  if (name.length < 2) {
    return NextResponse.json({ error: 'Nome do projeto inválido.' }, { status: 400 });
  }

  const siepProjectId = body.siepProjectId ? String(body.siepProjectId).trim() : null;
  if (siepProjectId) {
    const allowed = [
      engagement.operatorCompanyId,
      ...engagement.members.map((m) => m.companyId),
    ];
    const v = await validateEngagementSiep(siepProjectId, allowed);
    if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });
  }

  const maxSort = engagement.projects.reduce((acc, p) => Math.max(acc, p.sortOrder), 0);

  const project = await prisma.nexusAtProject.create({
    data: {
      engagementId: engagement.id,
      name: name.slice(0, 200),
      description: body.description ? String(body.description).trim().slice(0, 4000) : null,
      siepProjectId: siepProjectId || null,
      status: 'ACTIVE',
      sortOrder: maxSort + 1,
    },
    include: {
      siepProject: { select: { id: true, name: true, companyId: true } },
    },
  });

  await prisma.nexusAtEngagement.update({
    where: { id: engagement.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, project }, { status: 201 });
}
