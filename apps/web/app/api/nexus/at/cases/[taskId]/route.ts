export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { TaskStatus, Priority } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  AT_CASE_STATUSES,
  clientCompanyIds,
  enrichAtCase,
  loadAtCaseForTenant,
  userIsOperator,
} from '@/lib/nexus-at';

type Ctx = { params: Promise<{ taskId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { taskId } = await ctx.params;
  const loaded = await loadAtCaseForTenant(taskId, tenant.companyIds);
  if (!loaded) return NextResponse.json({ error: 'Caso AT não encontrado.' }, { status: 404 });

  return NextResponse.json({
    case: {
      ...loaded.enriched,
      checklist: await prisma.checklistItem.findMany({
        where: { taskId: loaded.task.id },
        orderBy: { order: 'asc' },
        select: { id: true, text: true, completed: true, order: true },
      }),
    },
    engagementId: loaded.engagement.id,
    isOperator: userIsOperator(loaded.engagement, tenant.companyIds),
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { taskId } = await ctx.params;
  const loaded = await loadAtCaseForTenant(taskId, tenant.companyIds);
  if (!loaded) return NextResponse.json({ error: 'Caso AT não encontrado.' }, { status: 404 });

  const isOp = userIsOperator(loaded.engagement, tenant.companyIds);
  const clients = clientCompanyIds(loaded.engagement);
  const taskCompany = loaded.task.companyId || '';

  if (!isOp) {
    if (!taskCompany || !tenant.companyIds.includes(taskCompany) || !clients.includes(taskCompany)) {
      return NextResponse.json({ error: 'Sem permissão para este caso.' }, { status: 403 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.status != null) {
    const status = String(body.status).trim().toUpperCase();
    if (!(AT_CASE_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
    }
    data.status = status as TaskStatus;
    if (status === 'DONE') data.completedAt = new Date();
    if (status !== 'DONE') data.completedAt = null;
  }

  if (body.priority != null) {
    const priority = String(body.priority).trim().toUpperCase();
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) {
      return NextResponse.json({ error: 'Prioridade inválida.' }, { status: 400 });
    }
    data.priority = priority as Priority;
  }

  if (body.title != null) {
    const title = String(body.title).trim();
    if (title.length < 2) return NextResponse.json({ error: 'Título inválido.' }, { status: 400 });
    data.title = title.slice(0, 180);
  }

  if (body.description !== undefined) {
    data.description = body.description ? String(body.description).trim().slice(0, 8000) : null;
  }

  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === '') {
      data.dueDate = null;
    } else {
      const d = new Date(String(body.dueDate));
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });
      }
      data.dueDate = d;
    }
  }

  if (body.assigneeId !== undefined) {
    data.assigneeId = body.assigneeId ? String(body.assigneeId).trim() : null;
  }

  if (body.take === true) {
    data.assigneeId = tenant.userId;
    if (!data.status) data.status = 'IN_PROGRESS' as TaskStatus;
  }

  const updated = await prisma.task.update({
    where: { id: loaded.task.id },
    data,
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
    where: { id: loaded.engagement.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, case: enrichAtCase(updated) });
}
