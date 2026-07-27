import 'server-only';

import { prisma } from '@/lib/prisma';
import { buildMeetRoomUrl } from '@/lib/meet/room';
import { meetRoomSlug, isMeetMirror, type MeetMirror } from '@/lib/meet/types';

export type CreateMeetSessionInput = {
  companyId: string;
  createdById?: string;
  title: string;
  description?: string;
  mirror?: MeetMirror;
  scheduledAt?: Date | null;
  endsAt?: Date | null;
  projectId?: string | null;
  forgeLiveSessionId?: string | null;
  /** E-mails a pré-registar como convidados */
  inviteEmails?: string[];
};

function meetClientReady(): boolean {
  return typeof (prisma as { meetSession?: { create?: unknown } }).meetSession?.create === 'function';
}

export function assertMeetPrismaReady() {
  if (!meetClientReady()) {
    throw new Error(
      'MeetSession ausente no Prisma Client. Rode: npx prisma generate && aplique prisma/migrations/manual_etholys_meet.sql',
    );
  }
}

export async function createMeetSession(input: CreateMeetSessionInput) {
  assertMeetPrismaReady();

  const mirror = input.mirror && isMeetMirror(input.mirror) ? input.mirror : 'loose';
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new Error('title required');

  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, companyId: input.companyId, isActive: true },
      select: { id: true },
    });
    if (!project) throw new Error('projectId inválido');
  }

  const tmpSlug = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const created = await prisma.meetSession.create({
    data: {
      companyId: input.companyId,
      createdById: input.createdById || null,
      title,
      description: input.description?.trim() || null,
      mirror,
      status: 'scheduled',
      scheduledAt: input.scheduledAt ?? new Date(),
      endsAt: input.endsAt ?? null,
      projectId: input.projectId || null,
      forgeLiveSessionId: input.forgeLiveSessionId || null,
      roomSlug: tmpSlug,
    },
  });

  const roomSlug = meetRoomSlug(created.id);
  const meetingUrl = buildMeetRoomUrl(created.id);

  const session = await prisma.meetSession.update({
    where: { id: created.id },
    data: { roomSlug, meetingUrl },
  });

  const emails = (input.inviteEmails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));

  if (emails.length > 0) {
    await prisma.meetParticipant.createMany({
      data: emails.map((email) => ({
        sessionId: session.id,
        email,
        role: 'guest',
      })),
    });
  }

  if (input.createdById) {
    await prisma.meetParticipant.create({
      data: {
        sessionId: session.id,
        userId: input.createdById,
        role: 'host',
      },
    });
  }

  return session;
}

export async function listMeetSessions(
  companyId: string,
  opts?: { limit?: number; projectId?: string },
) {
  assertMeetPrismaReady();
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 30));
  return prisma.meetSession.findMany({
    where: {
      companyId,
      ...(opts?.projectId ? { projectId: opts.projectId } : {}),
    },
    orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      _count: { select: { participants: true, actionItems: true } },
    },
  });
}

export async function getMeetSessionForCompany(sessionId: string, companyId: string) {
  assertMeetPrismaReady();
  return prisma.meetSession.findFirst({
    where: { id: sessionId, companyId },
    include: {
      participants: { orderBy: { invitedAt: 'asc' } },
      actionItems: { orderBy: { sortOrder: 'asc' } },
    },
  });
}
