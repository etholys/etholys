export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  AT_CASE_KIND_LABELS,
  buildAtCaseTags,
  clientCompanyIds,
  engagementCompanyIds,
  enrichAtCase,
  isAtCaseKind,
  listAtCasesForEngagement,
  loadEngagementForTenant,
  userIsOperator,
} from '@/lib/nexus-at';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const engagement = await loadEngagementForTenant(id, tenant.companyIds);
  if (!engagement) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });

  const projectId = req.nextUrl.searchParams.get('projectId') || undefined;
  const companyId = req.nextUrl.searchParams.get('companyId') || undefined;
  const openOnly = req.nextUrl.searchParams.get('openOnly') === '1';

  const clients = clientCompanyIds(engagement);
  const scope = clients.length ? clients : engagementCompanyIds(engagement);
  const casesRaw = await listAtCasesForEngagement(engagement.id, scope, { projectId, companyId, openOnly });
  const cases = casesRaw.map((c) => enrichAtCase(c));
  return NextResponse.json({
    cases,
    engagementId: engagement.id,
    projectId: projectId || null,
    companyId: companyId || null,
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const engagement = await loadEngagementForTenant(id, tenant.companyIds);
  if (!engagement) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });

  const isOp = userIsOperator(engagement, tenant.companyIds);
  const clients = clientCompanyIds(engagement);
  const allowedClients = clients.length ? clients : [engagement.operatorCompanyId];

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const projectId = String(body.projectId || '').trim();
  if (!projectId) {
    return NextResponse.json({ error: 'Escolha o projeto do serviço.' }, { status: 400 });
  }
  const project = engagement.projects.find((p) => p.id === projectId && p.isActive);
  if (!project) {
    return NextResponse.json({ error: 'Projeto inválido neste serviço.' }, { status: 400 });
  }

  const targetCompanyId = String(body.companyId || body.targetCompanyId || '').trim();
  if (!targetCompanyId) {
    return NextResponse.json({ error: 'Escolha a empresa.' }, { status: 400 });
  }
  if (!allowedClients.includes(targetCompanyId)) {
    return NextResponse.json({ error: 'Empresa inválida neste serviço.' }, { status: 403 });
  }

  if (!isOp && !tenant.companyIds.includes(targetCompanyId)) {
    return NextResponse.json({ error: 'Sem permissão para esta empresa.' }, { status: 403 });
  }

  const brief = String(body.brief || body.description || '').trim();
  if (brief.length < 8) {
    return NextResponse.json({ error: 'Descreva a necessidade (mínimo 8 caracteres).' }, { status: 400 });
  }

  const kindRaw = String(body.caseKind || body.kind || 'other').trim().toLowerCase();
  if (!isAtCaseKind(kindRaw)) {
    return NextResponse.json({ error: 'Tipo de caso inválido.' }, { status: 400 });
  }

  const companyName =
    engagement.members.find((m) => m.companyId === targetCompanyId)?.company.shortName ||
    engagement.members.find((m) => m.companyId === targetCompanyId)?.company.name ||
    '';

  const kindLabel = AT_CASE_KIND_LABELS[kindRaw].pt;
  const title =
    String(body.title || '').trim() ||
    `[AT] ${kindLabel} · ${project.name}${companyName ? ` · ${companyName}` : ''}`.slice(0, 180);

  const priority = String(body.priority || 'MEDIUM').trim().toUpperCase();
  const normalizedPriority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority) ? priority : 'MEDIUM';

  const dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;
  const siepId = project.siepProjectId || engagement.siepProjectId || undefined;

  const ticket = await prisma.task.create({
    data: {
      companyId: targetCompanyId,
      creatorId: tenant.userId,
      projectId: siepId,
      title: title.slice(0, 180),
      description: brief.slice(0, 8000),
      priority: normalizedPriority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      status: 'TODO',
      tags: buildAtCaseTags(engagement.id, project.id, kindRaw),
      dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : undefined,
      assigneeId: body.take === true || body.assignToMe === true ? tenant.userId : undefined,
      isActive: true,
      checklist: {
        create: Array.isArray(body.checklistItems)
          ? (body.checklistItems as unknown[])
              .map((x) => String(x || '').trim())
              .filter((t) => t.length >= 3)
              .slice(0, 20)
              .map((text, order) => ({ text: text.slice(0, 500), order }))
          : [],
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
      tags: true,
      companyId: true,
      assigneeId: true,
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  await prisma.nexusAtEngagement.update({
    where: { id: engagement.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, case: enrichAtCase(ticket) }, { status: 201 });
}
