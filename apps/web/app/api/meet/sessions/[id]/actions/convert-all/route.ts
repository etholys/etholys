export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

/** Converte todos os action items em draft/accepted para Tasks SIEP (requer projectId). */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json()) as { companyId?: string };
    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const session = await getMeetSessionForCompany(id, companyId);
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (!session.projectId) {
      return NextResponse.json(
        { error: 'Vincule um projeto SIEP à reunião antes de converter tarefas' },
        { status: 400 },
      );
    }

    const pending = session.actionItems.filter(
      (a) => (a.status === 'draft' || a.status === 'accepted') && !a.taskId,
    );

    const converted = [];
    for (const item of pending) {
      const descParts = [
        item.notes?.trim(),
        item.assigneeHint ? `Sugestão de responsável: ${item.assigneeHint}` : null,
        `Origem: Etholys Meet «${session.title}» (${session.id})`,
      ].filter(Boolean);

      const task = await prisma.task.create({
        data: {
          title: item.title.slice(0, 200),
          description: descParts.join('\n\n') || null,
          projectId: session.projectId,
          companyId,
          creatorId: tenant.userId,
          dueDate: item.dueHint,
          status: 'TODO',
          priority: 'MEDIUM',
        },
      });

      const updated = await prisma.meetActionItem.update({
        where: { id: item.id },
        data: { status: 'converted', taskId: task.id },
      });
      converted.push({ actionItem: updated, taskId: task.id });
    }

    return NextResponse.json({ converted: converted.length, items: converted });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
