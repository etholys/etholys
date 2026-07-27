import 'server-only';

import { prisma } from '@/lib/prisma';
import { createMeetSession, assertMeetPrismaReady } from '@/lib/meet/create-session';
import { meetEmbedUrl } from '@/lib/meet/room';

export type ForgeLiveForMeet = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  meetingUrl: string | null;
  courseId: string;
};

/**
 * Garante um MeetSession espelho `forge` ligado à ForgeLiveSession.
 * Se a live session não tiver meetingUrl, preenche com a sala Meet (breakouts via Jitsi).
 */
export async function ensureMeetForForgeLiveSession(opts: {
  companyId: string;
  createdById?: string;
  live: ForgeLiveForMeet;
  courseTitle?: string;
}): Promise<{
  meetSessionId: string;
  meetingUrl: string;
  created: boolean;
}> {
  assertMeetPrismaReady();

  const existing = await prisma.meetSession.findFirst({
    where: { forgeLiveSessionId: opts.live.id },
    orderBy: { createdAt: 'asc' },
  });

  if (existing?.meetingUrl) {
    if (!opts.live.meetingUrl) {
      await prisma.forgeLiveSession.update({
        where: { id: opts.live.id },
        data: { meetingUrl: existing.meetingUrl },
      });
    }
    return {
      meetSessionId: existing.id,
      meetingUrl: existing.meetingUrl,
      created: false,
    };
  }

  const title = opts.live.title.trim() || opts.courseTitle || 'FORGE live';
  const session = await createMeetSession({
    companyId: opts.companyId,
    createdById: opts.createdById,
    title: `[FORGE] ${title}`.slice(0, 200),
    description: opts.courseTitle
      ? `Capacitação FORGE — ${opts.courseTitle}`
      : 'Sessão ao vivo FORGE (Etholys Meet)',
    mirror: 'forge',
    scheduledAt: opts.live.startsAt,
    endsAt: opts.live.endsAt,
    forgeLiveSessionId: opts.live.id,
  });

  const meetingUrl = session.meetingUrl!;
  await prisma.forgeLiveSession.update({
    where: { id: opts.live.id },
    data: {
      meetingUrl: opts.live.meetingUrl?.trim() || meetingUrl,
    },
  });

  return { meetSessionId: session.id, meetingUrl, created: true };
}

/** URL de embed com breakouts visíveis para o host (capacitações). */
export function forgeMeetJoinUrl(meetingUrl: string, host = false): string {
  return meetEmbedUrl(meetingUrl, { host });
}
