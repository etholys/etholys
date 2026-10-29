export const dynamic = 'force-dynamic';
export const maxDuration = 600;

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { prisma } from '@/lib/prisma';
import { isMeetTranscribeConfigured, transcribeMeetRecording } from '@/lib/meet/transcribe';
import { diarizeWhisperSegments, formatDiarizedTranscript } from '@/lib/meet/diarize';
import { buildMeetDialogue } from '@/lib/meet/build-dialogue';
import { resolveMeetSpeechLanguage } from '@/lib/meet/language';
import { generateMeetPostMeeting } from '@/lib/meet/post-meeting';
import { notifyMeetActionsPending } from '@/lib/meet/notify-pending-actions';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Pipeline CHORUS pós-chamada:
 * Camada A (STT + diálogo clássico + resumo extrativo) sempre;
 * Camada B (IA) só se disponível — silenciosa.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const body = (await req.json()) as {
      companyId?: string;
      languageHint?: string;
      /** @deprecated — pós-reunião corre sempre após STT; mantido por compat */
      finalize?: boolean;
      locale?: string;
      diarize?: boolean;
      /** Reformatar texto já guardado (clássico + capa IA silenciosa) */
      reformatOnly?: boolean;
    };

    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const session = await getMeetSessionForCompany(id, companyId);
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const lang = resolveMeetSpeechLanguage({
      explicit: body.languageHint,
      uiLocale: body.locale,
    });

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
    const allSpeakerHints = [...new Set(participantNames)].slice(0, 24);

    async function persistDialogueLines(
      lines: Array<{ speaker: string; text: string; startSec?: number }>,
    ) {
      await prisma.meetTranscriptSegment.deleteMany({
        where: { sessionId: session!.id, messageId: { startsWith: 'chorus-whisper-' } },
      });
      const base = new Date(session!.startedAt || session!.scheduledAt || Date.now());
      const rows = lines.map((u, i) => {
        const nameMatch = participants.find((p) => {
          const label = (p.displayName || p.user?.name || '').toLowerCase();
          return label && label === u.speaker.toLowerCase();
        });
        const startSec = typeof u.startSec === 'number' ? u.startSec : i * 5;
        return {
          sessionId: session!.id,
          messageId: `chorus-whisper-${i}-${Math.round(startSec * 10)}`,
          participantId: nameMatch?.id ?? null,
          participantName: u.speaker,
          text: u.text,
          language: lang || null,
          startedAt: new Date(base.getTime() + Math.round(startSec * 1000)),
        };
      });
      if (rows.length > 0) {
        await prisma.meetTranscriptSegment.createMany({ data: rows });
      }
    }

    async function runPostMeeting(transcriptText: string) {
      let projectName: string | null = null;
      if (session!.projectId) {
        const p = await prisma.project.findFirst({
          where: { id: session!.projectId, companyId },
          select: { name: true },
        });
        projectName = p?.name ?? null;
      }

      const post = await generateMeetPostMeeting({
        title: session!.title,
        mirror: session!.mirror,
        projectName,
        notes: transcriptText,
        locale: body.locale,
        participants: allSpeakerHints,
        companyId,
      });

      await prisma.meetActionItem.deleteMany({
        where: { sessionId: session!.id, status: 'draft' },
      });

      let sort = 0;
      for (const item of post.actionItems) {
        let dueHint: Date | null = null;
        if (item.dueHint) {
          const d = new Date(item.dueHint);
          if (!Number.isNaN(d.getTime())) dueHint = d;
        }
        await prisma.meetActionItem.create({
          data: {
            sessionId: session!.id,
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
        where: { id: session!.id },
        data: {
          transcriptText,
          summaryText: post.summary.slice(0, 20_000),
          status: 'ended',
          endedAt: session!.endedAt ?? new Date(),
        },
        include: { actionItems: { orderBy: { sortOrder: 'asc' } } },
      });

      await notifyMeetActionsPending({
        companyId,
        sessionId: session!.id,
        sessionTitle: session!.title,
        createdById: session!.createdById,
        draftCount: post.actionItems.length,
      });

      return { updated, post };
    }

    // —— Reformatar texto existente (Camada A + B silenciosa) ——
    if (body.reformatOnly) {
      const source = (session.transcriptText || '').trim();
      if (source.length < 20) {
        return NextResponse.json(
          { error: 'Sem transcrição para reformatar. Execute Transcrever primeiro.' },
          { status: 400 },
        );
      }
      const dialogue = await buildMeetDialogue({
        rawText: source,
        participants: allSpeakerHints,
        locale: body.locale,
        languageHint: lang,
        meetingTitle: session.title,
        companyId,
      });
      if (dialogue.lines.length === 0) {
        return NextResponse.json({ error: 'Não foi possível formatar o diálogo.' }, { status: 500 });
      }
      await persistDialogueLines(dialogue.lines);
      const { updated, post } = await runPostMeeting(dialogue.text);
      return NextResponse.json({
        transcriptText: dialogue.text,
        model: dialogue.enhanced ? 'dialogue+ai' : 'dialogue-classic',
        diarized: true,
        utteranceCount: dialogue.lines.length,
        session: updated,
        finalized: true,
        reformatted: true,
        summaryEnhanced: post.enhanced,
      });
    }

    if (!isMeetTranscribeConfigured()) {
      return NextResponse.json(
        { error: 'A transcrição automática não está disponível neste momento.' },
        { status: 503 },
      );
    }

    if (!session.recordingUrl) {
      return NextResponse.json(
        {
          error:
            'Sem recordingUrl — faça upload da gravação ou aguarde a gravação na nuvem Etholys',
        },
        { status: 400 },
      );
    }

    const whisperPromptLang =
      lang === 'pt' ? 'português' : lang === 'en' ? 'English' : lang === 'es' ? 'español' : '';

    const whisper = await transcribeMeetRecording({
      recordingUrlOrKey: session.recordingUrl,
      languageHint: lang,
      promptHint: [
        whisperPromptLang
          ? `Reunião de trabalho em ${whisperPromptLang}.`
          : 'Reunião de trabalho.',
        allSpeakerHints.length ? `Participantes: ${allSpeakerHints.join(', ')}.` : '',
        session.title ? `Título: ${session.title}.` : '',
        'Transcreva com pontuação clara e mudanças de falante quando possível.',
      ]
        .filter(Boolean)
        .join(' '),
    });

    const liveHints = await prisma.meetTranscriptSegment.findMany({
      where: {
        sessionId: session.id,
        messageId: { startsWith: 'live-jigasi-' },
      },
      orderBy: { startedAt: 'asc' },
      take: 120,
      select: { participantName: true, text: true },
    });

    const shouldDiarize = body.diarize !== false && whisper.segments.length > 0;
    let diarizedUtterances: Awaited<ReturnType<typeof diarizeWhisperSegments>> | undefined;
    let transcriptText = whisper.text;
    let utteranceCount = 0;

    if (shouldDiarize && whisper.segments.length > 0) {
      try {
        diarizedUtterances = await diarizeWhisperSegments({
          segments: whisper.segments,
          participants: allSpeakerHints,
          liveHints: liveHints.map((h) => ({
            speaker: h.participantName,
            text: h.text,
          })),
          locale: body.locale,
          languageHint: lang,
          companyId,
        });
        if (diarizedUtterances.length > 0) {
          transcriptText = formatDiarizedTranscript(diarizedUtterances);
          utteranceCount = diarizedUtterances.length;
        }
      } catch (diarizeErr) {
        console.error('[meet/transcribe] diarize fallback', diarizeErr);
      }
    }

    const dialogue = await buildMeetDialogue({
      rawText: transcriptText || whisper.text,
      utterances: diarizedUtterances,
      participants: allSpeakerHints,
      locale: body.locale,
      languageHint: lang,
      meetingTitle: session.title,
      companyId,
    });

    if (dialogue.lines.length > 0) {
      transcriptText = dialogue.text;
      utteranceCount = dialogue.lines.length;
      await persistDialogueLines(dialogue.lines);
    }

    const { updated, post } = await runPostMeeting(transcriptText);

    return NextResponse.json({
      transcriptText,
      model: whisper.model,
      diarized: utteranceCount > 0,
      utteranceCount,
      session: updated,
      finalized: true,
      dialogueEnhanced: dialogue.enhanced,
      summaryEnhanced: post.enhanced,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/transcribe]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
