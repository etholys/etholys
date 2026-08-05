export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { prisma } from '@/lib/prisma';
import { isMeetTranscribeConfigured, transcribeMeetRecording } from '@/lib/meet/transcribe';
import { generateMeetPostMeetingAi } from '@/lib/meet/post-meeting-ai';
import { notifyMeetActionsPending } from '@/lib/meet/notify-pending-actions';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Transcreve a gravação (Whisper) e opcionalmente corre o fluxo pós-reunião.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json()) as {
      companyId?: string;
      languageHint?: string;
      finalize?: boolean;
      locale?: string;
    };

    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    if (!isMeetTranscribeConfigured()) {
      return NextResponse.json(
        {
          error:
            'STT não configurado. Defina OPENAI_API_KEY ou MEET_TRANSCRIBE_API_KEY (Whisper).',
        },
        { status: 503 },
      );
    }

    const session = await getMeetSessionForCompany(id, companyId);
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (!session.recordingUrl) {
      return NextResponse.json(
        { error: 'Sem recordingUrl — faça upload ou aguarde o webhook Jibri' },
        { status: 400 },
      );
    }

    const lang =
      body.languageHint ||
      (body.locale === 'es' ? 'es' : body.locale === 'en' ? 'en' : body.locale === 'pt' ? 'pt' : undefined);

    const { text, model } = await transcribeMeetRecording({
      recordingUrlOrKey: session.recordingUrl,
      languageHint: lang,
    });

    let projectName: string | null = null;
    if (session.projectId) {
      const p = await prisma.project.findFirst({
        where: { id: session.projectId, companyId },
        select: { name: true },
      });
      projectName = p?.name ?? null;
    }

    if (body.finalize) {
      const ai = await generateMeetPostMeetingAi({
        title: session.title,
        mirror: session.mirror,
        projectName,
        notes: text,
        locale: body.locale,
      });

      await prisma.meetActionItem.deleteMany({
        where: { sessionId: session.id, status: 'draft' },
      });

      let sort = 0;
      for (const item of ai.actionItems) {
        let dueHint: Date | null = null;
        if (item.dueHint) {
          const d = new Date(item.dueHint);
          if (!Number.isNaN(d.getTime())) dueHint = d;
        }
        await prisma.meetActionItem.create({
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
      }

      const updated = await prisma.meetSession.update({
        where: { id: session.id },
        data: {
          transcriptText: text,
          summaryText: ai.summary.slice(0, 20_000),
          status: 'ended',
          endedAt: session.endedAt ?? new Date(),
        },
        include: { actionItems: { orderBy: { sortOrder: 'asc' } } },
      });

      await notifyMeetActionsPending({
        companyId,
        sessionId: session.id,
        sessionTitle: session.title,
        createdById: session.createdById,
        draftCount: ai.actionItems.length,
      });

      return NextResponse.json({
        transcriptText: text,
        model,
        session: updated,
        finalized: true,
      });
    }

    const updated = await prisma.meetSession.update({
      where: { id: session.id },
      data: { transcriptText: text },
      select: { id: true, transcriptText: true, recordingUrl: true },
    });

    return NextResponse.json({ transcriptText: text, model, session: updated, finalized: false });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/transcribe]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
