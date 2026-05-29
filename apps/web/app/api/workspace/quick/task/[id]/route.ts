export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { getWorkspaceAccessForUser, hasSystem } from '@/lib/integrated-workspace';
import type { TaskStatus } from '@prisma/client';

/**
 * Atalho: alterar tarefa (ex.: concluir) a partir do centro integrado.
 * As alterações refletem-se no ATLAS / mesmo registo de Task.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const companyId = req.nextUrl.searchParams.get('companyId')?.trim() || tenant.companyIds[0] || '';
  if (!companyId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });
  }

  const access = await getWorkspaceAccessForUser(tenant.userId, companyId);
  if (!access.ok || !hasSystem(access, 'ATLAS')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const nextStatus = String(body.status || '').trim() as TaskStatus;
  const allowed: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED', 'BACKLOG'];
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  const found = await prisma.task.findFirst({
    where: { id: params.id, isActive: true },
    include: { project: { select: { companyId: true } } },
  });
  if (!found) {
    return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
  }
  const taskCompany = found.companyId || found.project?.companyId;
  if (!taskCompany || !tenant.companyIds.includes(taskCompany)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const updated = await prisma.task.update({
    where: { id: params.id },
    data: {
      status: nextStatus,
      completedAt: nextStatus === 'DONE' ? new Date() : null,
    },
    select: { id: true, status: true, title: true },
  });

  return NextResponse.json({ ok: true, task: updated });
}
