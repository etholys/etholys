export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { assertJibriWebhookAuth, applyJibriRecording } from '@/lib/meet/jibri-webhook';
import { isMeetTranscribeConfigured, transcribeMeetRecording } from '@/lib/meet/transcribe';
import { prisma } from '@/lib/prisma';
import { notifyMeetActionsPending } from '@/lib/meet/notify-pending-actions';
import { generateMeetPostMeetingAi } from '@/lib/meet/post-meeting-ai';

/**
 * Webhook Jibri / finalize script → grava recordingUrl (e opcionalmente sobe para R2).
 * Auth: Authorization: Bearer $MEET_JIBRI_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  try {
    assertJibriWebhookAuth(req);
    const payload = (await req.json()) as {
      roomSlug?: string;
      sessionId?: string;
      recordingUrl?: string;
      fileUrl?: string;
      fileBase64?: string;
      contentType?: string;
      filename?: string;
      transcribe?: boolean;
      finalize?: boolean;
    };

    const result = await applyJibriRecording(payload);

    let transcriptText: string | null = null;
    if (payload.transcribe || payload.finalize) {
      if (!isMeetTranscribeConfigured()) {
        return NextResponse.json({
          ...result,
          warning: 'Gravação guardada; a transcrição automática não está disponível.',
        });
      }
      const { text } = await transcribeMeetRecording({
        recordingUrlOrKey: result.recordingUrl,
      });
      transcriptText = text;

      const session = await prisma.meetSession.findUnique({ where: { id: result.sessionId } });
      if (!session) return NextResponse.json({ ...result, transcriptText });

      if (payload.finalize) {
        let projectName: string | null = null;
        if (session.projectId) {
          const p = await prisma.project.findFirst({
            where: { id: session.projectId },
            select: { name: true },
          });
          projectName = p?.name ?? null;
        }
        const ai = await generateMeetPostMeetingAi({
          title: session.title,
          mirror: session.mirror,
          projectName,
          notes: text,
        });
        await prisma.meetActionItem.deleteMany({
          where: { sessionId: session.id, status: 'draft' },
        });
        let sort = 0;
        for (const item of ai.actionItems) {
          await prisma.meetActionItem.create({
            data: {
              sessionId: session.id,
              title: item.title,
              notes: item.notes || null,
              assigneeHint: item.assigneeHint || null,
              status: 'draft',
              sortOrder: sort++,
            },
          });
        }
        await prisma.meetSession.update({
          where: { id: session.id },
          data: {
            transcriptText: text,
            summaryText: ai.summary.slice(0, 20_000),
            status: 'ended',
            endedAt: session.endedAt ?? new Date(),
          },
        });
        await notifyMeetActionsPending({
          companyId: session.companyId,
          sessionId: session.id,
          sessionTitle: session.title,
          createdById: session.createdById,
          draftCount: ai.actionItems.length,
        });
      } else {
        await prisma.meetSession.update({
          where: { id: session.id },
          data: { transcriptText: text },
        });
      }
    }

    return NextResponse.json({ ok: true, ...result, transcriptText });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    const status = msg === 'Unauthorized' ? 401 : msg.includes('não encontrad') ? 404 : 500;
    if (status >= 500) console.error('[meet/webhooks/jibri]', error);
    return NextResponse.json({ error: msg }, { status });
  }
}
