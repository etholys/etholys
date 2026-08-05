export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { generateMeetPostMeetingAi } from '@/lib/meet/post-meeting-ai';
import { notifyMeetActionsPending } from '@/lib/meet/notify-pending-actions';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Encerra a reunião (opcional), guarda notas/transcrição e gera resumo + tarefas em rascunho (IA).
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json()) as {
      companyId?: string;
      notes?: string;
      transcriptText?: string;
      endMeeting?: boolean;
      replaceDrafts?: boolean;
      locale?: string;
    };

    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const session = await getMeetSessionForCompany(id, companyId);
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const notes = [body.transcriptText, body.notes, session.transcriptText]
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .join('\n\n')
      .trim();

    if (notes.length < 20) {
      return NextResponse.json(
        { error: 'Envie notas ou transcrição (mínimo ~20 caracteres)' },
        { status: 400 },
      );
    }

    let projectName: string | null = null;
    if (session.projectId) {
      const p = await prisma.project.findFirst({
        where: { id: session.projectId, companyId },
        select: { name: true },
      });
      projectName = p?.name ?? null;
    }

    const ai = await generateMeetPostMeetingAi({
      title: session.title,
      mirror: session.mirror,
      projectName,
      notes,
      locale: body.locale,
    });

    if (body.replaceDrafts !== false) {
      await prisma.meetActionItem.deleteMany({
        where: { sessionId: session.id, status: 'draft' },
      });
    }

    const createdActions = [];
    let sort = 0;
    for (const item of ai.actionItems) {
      let dueHint: Date | null = null;
      if (item.dueHint) {
        const d = new Date(item.dueHint);
        if (!Number.isNaN(d.getTime())) dueHint = d;
      }
      const row = await prisma.meetActionItem.create({
        data: {
          sessionId: session.id,
          title: item.title,
          notes: item.notes || null,
          assigneeHint: item.assigneeHint || null,
          dueHint,
          status: 'draft',
          sortOrder: sort++,
        },
      });
      createdActions.push(row);
    }

    const updated = await prisma.meetSession.update({
      where: { id: session.id },
      data: {
        transcriptText: notes.slice(0, 100_000),
        summaryText: ai.summary.slice(0, 20_000),
        ...(body.endMeeting !== false
          ? { status: 'ended', endedAt: session.endedAt ?? new Date() }
          : {}),
      },
      include: {
        participants: true,
        actionItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await notifyMeetActionsPending({
      companyId,
      sessionId: session.id,
      sessionTitle: session.title,
      createdById: session.createdById,
      draftCount: createdActions.length,
    });

    return NextResponse.json({
      session: updated,
      ai: {
        decisions: ai.decisions,
        nextSteps: ai.nextSteps,
        actionItemsCreated: createdActions.length,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/finalize]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
