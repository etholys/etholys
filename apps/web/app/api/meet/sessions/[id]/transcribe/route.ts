export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { prisma } from '@/lib/prisma';
import { isMeetTranscribeConfigured, transcribeMeetRecording } from '@/lib/meet/transcribe';
import { diarizeWhisperSegments, formatDiarizedTranscript } from '@/lib/meet/diarize';
import { generateMeetPostMeetingAi } from '@/lib/meet/post-meeting-ai';
import { notifyMeetActionsPending } from '@/lib/meet/notify-pending-actions';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Pipeline CHORUS pós-chamada: Whisper (timestamps) → diarização por participante → opcional IA.
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
      diarize?: boolean;
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
        {
          error:
            'Sem recordingUrl — faça upload da gravação ou aguarde a gravação na nuvem Etholys',
        },
        { status: 400 },
      );
    }

    const lang =
      body.languageHint ||
      (body.locale === 'es'
        ? 'es'
        : body.locale === 'en'
          ? 'en'
          : body.locale === 'pt'
            ? 'pt'
            : undefined);

    const participants = await prisma.meetParticipant.findMany({
      where: { sessionId: session.id },
      select: {
        id: true,
        displayName: true,
        email: true,
        user: { select: { name: true } },
      },
    });

    const participantNames = participants
      .map((p) => p.displayName || p.user?.name || p.email || '')
      .filter(Boolean);

    const whisper = await transcribeMeetRecording({
      recordingUrlOrKey: session.recordingUrl,
      languageHint: lang,
      promptHint: [
        'CHORUS meeting transcript.',
        participantNames.length ? `Participants: ${participantNames.join(', ')}.` : '',
        session.title ? `Meeting title: ${session.title}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    });

    const liveHints = await prisma.meetTranscriptSegment.findMany({
      where: {
        sessionId: session.id,
        NOT: { messageId: { startsWith: 'chorus-whisper-' } },
      },
      orderBy: { startedAt: 'asc' },
      take: 120,
      select: { participantName: true, text: true },
    });

    const shouldDiarize = body.diarize !== false && whisper.segments.length > 0;
    let transcriptText = whisper.text;
    let utteranceCount = 0;

    if (shouldDiarize) {
      try {
        const utterances = await diarizeWhisperSegments({
          segments: whisper.segments,
          participants: participantNames,
          liveHints: liveHints.map((h) => ({
            speaker: h.participantName,
            text: h.text,
          })),
          locale: body.locale,
        });
        if (utterances.length > 0) {
          transcriptText = formatDiarizedTranscript(utterances);
          utteranceCount = utterances.length;

          await prisma.meetTranscriptSegment.deleteMany({
            where: {
              sessionId: session.id,
              messageId: { startsWith: 'chorus-whisper-' },
            },
          });
          const base = new Date(session.startedAt || session.scheduledAt || Date.now());
          const rows = utterances.map((u, i) => {
            const nameMatch = participants.find((p) => {
              const label = (p.displayName || p.user?.name || '').toLowerCase();
              return label && label === u.speaker.toLowerCase();
            });
            return {
              sessionId: session.id,
              messageId: `chorus-whisper-${i}-${Math.round(u.startSec * 10)}`,
              participantId: nameMatch?.id ?? null,
              participantName: u.speaker,
              text: u.text,
              language: lang || null,
              startedAt: new Date(base.getTime() + Math.round(u.startSec * 1000)),
            };
          });
          if (rows.length > 0) {
            await prisma.meetTranscriptSegment.createMany({ data: rows });
          }
        }
      } catch (diarizeErr) {
        console.error('[meet/transcribe] diarize fallback', diarizeErr);
      }
    }

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
        notes: transcriptText,
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
          transcriptText,
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
        transcriptText,
        model: whisper.model,
        diarized: utteranceCount > 0,
        utteranceCount,
        session: updated,
        finalized: true,
      });
    }

    const updated = await prisma.meetSession.update({
      where: { id: session.id },
      data: { transcriptText },
      select: { id: true, transcriptText: true, recordingUrl: true },
    });

    return NextResponse.json({
      transcriptText,
      model: whisper.model,
      diarized: utteranceCount > 0,
      utteranceCount,
      session: updated,
      finalized: false,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/transcribe]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
