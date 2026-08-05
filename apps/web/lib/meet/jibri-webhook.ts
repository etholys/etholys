import 'server-only';

import { prisma } from '@/lib/prisma';
import { putMeetRecordingBuffer, isMeetRecordingStorageReady } from '@/lib/meet/recording-storage';

export type JibriWebhookPayload = {
  /** roomSlug Jitsi (ex.: etholys-meet-xxx) ou MeetSession.id */
  roomSlug?: string;
  sessionId?: string;
  /** URL já pública da gravação (Jibri noutro host) */
  recordingUrl?: string;
  /** URL temporária para a app ir buscar e guardar em R2 */
  fileUrl?: string;
  fileBase64?: string;
  contentType?: string;
  filename?: string;
  /** Se true, dispara transcrição depois (best-effort) */
  transcribe?: boolean;
};

export function assertJibriWebhookAuth(req: Request): void {
  const secret = process.env.MEET_JIBRI_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error('MEET_JIBRI_WEBHOOK_SECRET não configurado');
  }
  const auth = req.headers.get('authorization')?.trim() || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const header = req.headers.get('x-meet-jibri-secret')?.trim() || '';
  if (bearer !== secret && header !== secret) {
    throw new Error('Unauthorized');
  }
}

export async function applyJibriRecording(payload: JibriWebhookPayload): Promise<{
  sessionId: string;
  recordingUrl: string;
  storageKey?: string;
}> {
  const roomSlug = payload.roomSlug?.trim();
  const sessionId = payload.sessionId?.trim();

  const session = sessionId
    ? await prisma.meetSession.findUnique({ where: { id: sessionId } })
    : roomSlug
      ? await prisma.meetSession.findFirst({
          where: {
            OR: [{ roomSlug }, { id: roomSlug }, { meetingUrl: { contains: roomSlug } }],
          },
          orderBy: { createdAt: 'desc' },
        })
      : null;

  if (!session) throw new Error('MeetSession não encontrada para este room');

  let recordingUrl = payload.recordingUrl?.trim() || '';
  let storageKey: string | undefined;

  if (!recordingUrl && (payload.fileUrl || payload.fileBase64)) {
    if (!isMeetRecordingStorageReady()) {
      throw new Error('Object storage necessário para receber ficheiro Jibri (configure R2/S3)');
    }
    let body: Buffer;
    let contentType = payload.contentType || 'video/mp4';
    const filename = payload.filename || `jibri-${session.roomSlug}.mp4`;

    if (payload.fileBase64) {
      body = Buffer.from(payload.fileBase64, 'base64');
    } else {
      const res = await fetch(payload.fileUrl!);
      if (!res.ok) throw new Error(`Falha ao obter ficheiro Jibri (${res.status})`);
      body = Buffer.from(await res.arrayBuffer());
      contentType = res.headers.get('content-type') || contentType;
    }

    const put = await putMeetRecordingBuffer({
      sessionId: session.id,
      fileName: filename,
      contentType,
      body,
    });
    recordingUrl = put.recordingUrl;
    storageKey = put.storageKey;
  }

  if (!recordingUrl) {
    throw new Error('Envie recordingUrl, fileUrl ou fileBase64');
  }

  await prisma.meetSession.update({
    where: { id: session.id },
    data: { recordingUrl },
  });

  return { sessionId: session.id, recordingUrl, storageKey };
}
