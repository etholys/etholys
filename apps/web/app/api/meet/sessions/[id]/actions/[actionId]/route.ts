export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string; actionId: string }> };

/**
 * Valida um action item: accept | reject | convert (cria Task SIEP se houver projectId).
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id, actionId } = await ctx.params;
    const body = (await req.json()) as {
      companyId?: string;
      action?: 'accept' | 'reject' | 'convert';
    };

    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const action = body.action;
    if (!action || !['accept', 'reject', 'convert'].includes(action)) {
      return NextResponse.json({ error: 'action inválida' }, { status: 400 });
    }

    const session = await getMeetSessionForCompany(id, companyId);
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const item = session.actionItems.find((a) => a.id === actionId);
    if (!item) return NextResponse.json({ error: 'Action item no encontrado' }, { status: 404 });

    if (action === 'reject') {
      const updated = await prisma.meetActionItem.update({
        where: { id: actionId },
        data: { status: 'rejected' },
      });
      return NextResponse.json({ actionItem: updated });
    }

    if (action === 'accept') {
      const updated = await prisma.meetActionItem.update({
        where: { id: actionId },
        data: { status: 'accepted' },
      });
      return NextResponse.json({ actionItem: updated });
    }

    // convert → Task SIEP (precisa projectId na sessão)
    if (!session.projectId) {
      return NextResponse.json(
        {
          error:
            'Esta reunião não está vinculada a um projeto SIEP. Vincule um projeto ou use accept.',
        },
        { status: 400 },
      );
    }

    if (item.taskId) {
      return NextResponse.json({
        actionItem: item,
        taskId: item.taskId,
        alreadyConverted: true,
      });
    }

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
      where: { id: actionId },
      data: { status: 'converted', taskId: task.id },
    });

    return NextResponse.json({ actionItem: updated, task });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/action]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
